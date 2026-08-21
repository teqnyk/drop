import { headers } from "next/headers";
import { releases } from "@/lib/db";
import { deviceKind, recordEvent, referrerHost } from "@/lib/events";
import { configured } from "@/lib/env";
import { BuyButton } from "./buy-button";

/**
 * The storefront.
 *
 * Renders from the `releases` collection, never from a constant. PRD §8 is
 * explicit about this and the reason is the demo itself: a hardcoded storefront
 * keeps working during a database outage, which is precisely the failure Drop
 * exists to show.
 */
export const dynamic = "force-dynamic";

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amount / 100);
}

export default async function StorefrontPage() {
  if (!configured.mongo()) return <NotConfigured />;

  const release = await (await releases()).findOne({ slug: "form-01" });
  if (!release) return <NoRelease />;

  const sold = release.quantity_total - release.quantity_remaining;
  const soldOut = release.status === "sold_out" || release.quantity_remaining <= 0;
  const paused = release.status === "paused" || release.status === "draft";

  const h = await headers();
  void recordEvent({
    type: "view",
    releaseSlug: release.slug,
    referrer: referrerHost(h.get("referer")),
    device: deviceKind(h.get("user-agent")),
  });

  return (
    <main className="wrap" style={{ paddingTop: 56, paddingBottom: 96 }}>
      <p className="eyebrow">{release.studio_name}</p>

      <div className="release">
        <div>
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
            <BuyButton slug={release.slug} soldOut={soldOut} />
          )}

          <p className="muted small" style={{ marginTop: 16 }}>
            {sold} sold · instant download · delivered by email
          </p>
        </aside>
      </div>
    </main>
  );
}

function NotConfigured() {
  return (
    <main className="wrap" style={{ paddingTop: 64 }}>
      <h1>Not configured</h1>
      <p className="muted" style={{ marginTop: 12 }}>
        <code>MONGODB_URI</code> is not set, so there is no storefront to show.
        Copy <code>.env.example</code> to <code>.env.local</code> and fill it in.
      </p>
    </main>
  );
}

function NoRelease() {
  return (
    <main className="wrap" style={{ paddingTop: 64 }}>
      <h1>No release</h1>
      <p className="muted" style={{ marginTop: 12 }}>
        The database is reachable but holds no release. Run <code>pnpm seed</code>.
      </p>
    </main>
  );
}
