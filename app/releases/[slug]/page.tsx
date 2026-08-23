import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { releases } from "@/lib/db";
import { deviceKind, recordEvent, referrerHost } from "@/lib/events";
import { configured } from "@/lib/env";
import { emitAsync, metrics } from "@/lib/telemetry";
import { activeScenario } from "@/lib/scenarios";
import { money } from "@/lib/format";
import { BuyButton } from "@/app/buy-button";

export const dynamic = "force-dynamic";

export default async function ReleasePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!configured.mongo()) {
    return (
      <main className="wrap" style={{ paddingTop: 64 }}>
        <h1>Not configured</h1>
        <p className="muted" style={{ marginTop: 12 }}>
          <code>MONGODB_URI</code> is not set, so there is no storefront to show.
        </p>
      </main>
    );
  }

  const release = await (await releases()).findOne({ slug });
  if (!release) notFound();

  const sold = release.quantity_total - release.quantity_remaining;
  const soldOut = release.status === "sold_out" || release.quantity_remaining <= 0;
  const paused = release.status === "paused" || release.status === "draft";
  // Read on the server so the client bundle carries no switch a visitor could
  // flip from the console.
  const breakCheckout = Boolean(await activeScenario("frontend_exception"));

  const h = await headers();
  emitAsync([
    ...metrics.storefrontView({ release: release.slug }),
    ...metrics.inventoryRemaining(release.quantity_remaining, { release: release.slug }),
  ]);
  void recordEvent({
    type: "view",
    releaseSlug: release.slug,
    referrer: referrerHost(h.get("referer")),
    device: deviceKind(h.get("user-agent")),
  });

  return (
    <main className="wrap" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <p className="muted small" style={{ marginBottom: 24 }}>
        <Link href={`/studios/${release.studio_slug}`}>← {release.studio_name}</Link>
      </p>

      <div
        className="release-art"
        style={{
          background: `linear-gradient(135deg, ${release.palette[0]}, ${release.palette[1]})`,
        }}
        aria-hidden="true"
      />

      <div className="release">
        <div>
          <p className="eyebrow">
            <Link href={`/studios/${release.studio_slug}`}>{release.studio_name}</Link>
          </p>
          <h1>{release.title}</h1>
          <p className="lede">{release.description}</p>

          <ul className="contents">
            {release.contents.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <p className="licence muted">{release.licence}</p>
        </div>

        <aside className="buy">
          <p className="price">{money(release.price_amount, release.currency)}</p>

          {/* Availability is stated plainly, including when it is bad news. A
              storefront that hides a sold-out edition behind a disabled button
              with no explanation is the customer-facing version of a silent
              failure. */}
          <p className="stock">
            {soldOut ? (
              <strong>Sold out</strong>
            ) : (
              <>
                <strong>{release.quantity_remaining}</strong> of {release.quantity_total} left
              </>
            )}
          </p>

          {paused ? (
            <p className="muted small">This release is paused. Check back shortly.</p>
          ) : (
            <BuyButton slug={release.slug} soldOut={soldOut} throwOnClick={breakCheckout} />
          )}

          <p className="muted small" style={{ marginTop: 16 }}>
            {sold} sold · instant download · delivered by email
          </p>
        </aside>
      </div>
    </main>
  );
}
