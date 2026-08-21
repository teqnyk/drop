import { NextResponse } from "next/server";
import { entitlements, orders } from "@/lib/db";
import { hashToken } from "@/lib/orders";
import { recordEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * Redeem a download entitlement.
 *
 * The token is looked up by HASH — the raw value exists only in the customer's
 * email, so a database dump does not hand over every download. PRD §12 also
 * requires the asset not be publicly enumerable, which is why the token is 32
 * random bytes rather than an order id.
 *
 * Phase 1 has no object storage yet, so a redeemed entitlement returns a
 * placeholder rather than a file. That is stated in the response instead of
 * pretending: a demo that silently returns an empty file would be exactly the
 * kind of plausible-looking success Drop exists to argue against.
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

  await (await entitlements()).updateOne(
    { token_hash: ent.token_hash },
    { $inc: { download_count: 1 }, $set: { last_downloaded_at: new Date().toISOString() } },
  );

  const order = await (await orders()).findOne({ purchase_id: ent.purchase_id });
  void recordEvent({
    type: "download",
    releaseSlug: order?.release_slug ?? "form-01",
    purchaseId: ent.purchase_id,
    isDemo: order?.is_demo ?? true,
  });

  return NextResponse.json({
    ok: true,
    note:
      "Object storage arrives in a later phase — this endpoint proves the " +
      "entitlement, not the file. It is saying so rather than returning an " +
      "empty download.",
    purchase_id: ent.purchase_id,
    downloads: ent.download_count + 1,
    expires_at: ent.expires_at.toISOString(),
  });
}
