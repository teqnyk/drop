import { NextResponse } from "next/server";
import { entitlements, orders, releases } from "@/lib/db";
import { hashToken } from "@/lib/orders";
import { recordEvent } from "@/lib/events";
import { emitAsync, metrics } from "@/lib/telemetry";
import { getProductAsset } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Redeem a download entitlement.
 *
 * The token is looked up by HASH — the raw value exists only in the customer's
 * email, so a database dump does not hand over every download. PRD §12 also
 * requires the asset not be publicly enumerable, which is why the token is 32
 * random bytes rather than an order id, and why the file is streamed from a
 * private bucket rather than redirected to.
 *
 * A valid entitlement whose file cannot be served returns an ERROR, never an
 * empty body with a 200 and a Content-Disposition header. A zero-byte download
 * that the browser saves as `form-01.zip` is the worst outcome available here:
 * the customer believes they have the product, the dashboard believes it was
 * delivered, and nobody finds out until someone tries to open it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const ent = await (await entitlements()).findOne({ token_hash: hashToken(token) });
  if (!ent) {
    // Deliberately identical for "never existed" and "revoked": distinguishing
    // them tells someone guessing tokens when they are close.
    return NextResponse.json(
      { error: "This download link isn't valid. Check the link in your email." },
      { status: 404 },
    );
  }

  if (ent.expires_at <= new Date()) {
    // Expiry has a recovery path (PRD §12) — a dead end here is a support email.
    return NextResponse.json(
      {
        error: "This download link has expired.",
        recovery: "Reply to your confirmation email and we'll send a fresh one.",
      },
      { status: 410 },
    );
  }

  const order = await (await orders()).findOne({ purchase_id: ent.purchase_id });
  const slug = order?.release_slug ?? "form-01";
  const release = await (await releases()).findOne({ slug });

  if (!release) {
    return NextResponse.json(
      {
        error: "We can't find the product this link belongs to.",
        detail: `No release with slug "${slug}".`,
        recovery: "Reply to your confirmation email and we'll sort it out.",
      },
      { status: 500 },
    );
  }

  const asset = await getProductAsset(release.product_asset_key);
  if (!asset.ok) {
    // The customer gets a sentence they can act on; the operator gets the
    // actual cause, because "try again later" is a lie when the bucket is
    // simply not bound. Both, in one response.
    return NextResponse.json(
      {
        error: "Your link is valid, but we couldn't fetch the file.",
        reason: asset.reason,
        detail: asset.detail,
        recovery: "Reply to your confirmation email — this one is on us, not you.",
      },
      { status: asset.reason === "not_configured" ? 503 : 500 },
    );
  }

  // Counted only once the bytes are on their way. Incrementing before the
  // fetch would charge a download against an entitlement that got an error.
  await (await entitlements()).updateOne(
    { token_hash: ent.token_hash },
    { $inc: { download_count: 1 }, $set: { last_downloaded_at: new Date().toISOString() } },
  );

  emitAsync(metrics.downloadServed({ "drop.purchase_id": ent.purchase_id }));
  void recordEvent({
    type: "download",
    releaseSlug: slug,
    purchaseId: ent.purchase_id,
    isDemo: order?.is_demo ?? true,
  });

  return new Response(asset.body, {
    headers: {
      "content-type": asset.contentType,
      "content-length": String(asset.size),
      "content-disposition": `attachment; filename="${downloadFilename(release.product_asset_key)}"`,
      // A private bucket behind a single-use-ish token has no business in any
      // shared cache.
      "cache-control": "private, no-store",
    },
  });
}

/**
 * The name the customer's browser saves.
 *
 * Derived from the key's basename and stripped of anything that could break
 * out of the quoted header value — a filename is attacker-influenced the
 * moment a release is editable.
 */
function downloadFilename(key: string): string {
  const base = key.split("/").pop() ?? "download";
  const safe = base.replace(/[^A-Za-z0-9._-]/g, "_");
  return safe || "download";
}
