import { orders, releases } from "@/lib/db";
import { configured } from "@/lib/env";
import { fulfilmentJobs } from "@/lib/fulfilment";
import { ReleaseControls, ResendButton } from "./controls";
import Link from "next/link";
import { authBypassAllowed, currentCreator } from "@/lib/auth";
import { productAssetPresent } from "@/lib/storage";
import { signOut } from "../signin/actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The creator dashboard (PRD §8).
 *
 * Deliberately small. Its job is not to be an analytics product — it is to give
 * an incident a business consequence on screen. Before this page exists, a demo
 * can only show telemetry; with it, "payments are failing" becomes "eleven
 * people tried to buy and four got through".
 *
 * Behind Supabase Auth plus a creator allowlist (lib/auth.ts). It lists
 * buyers' email addresses and can pause the release, so an open version of
 * this page was a data-protection problem and a control-plane problem at once.
 *
 * Unconfigured, it refuses in production and explains itself in development —
 * a deployment that forgets its environment variables gets a locked door, not
 * an open control panel.
 */
function money(minor: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() })
    .format(minor / 100);
}

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export default async function DashboardPage() {
  const creator = await currentCreator();
  const bypass = authBypassAllowed();
  if (!creator && !bypass) {
    // Not "access denied". A valid session that is not on the allowlist is a
    // different situation from no session at all, and the sign-in page says
    // which one it is.
    redirect("/signin?next=/dashboard");
  }

  if (!configured.mongo()) {
    return (
      <main className="wrap" style={{ paddingTop: 56 }}>
        <h1>Dashboard</h1>
        <p className="muted" style={{ marginTop: 12 }}>
          <code>MONGODB_URI</code> is not set.
        </p>
      </main>
    );
  }

  const ordersCol = await orders();
  const catalogue = await (await releases()).find({}).toArray();
  const recent = await ordersCol.find({}).sort({ created_at: -1 }).limit(25).toArray();
  const jobs = await (await fulfilmentJobs())
    .find({ purchase_id: { $in: recent.map((o) => o.purchase_id) } })
    .toArray();
  const jobFor = new Map(jobs.map((j) => [j.purchase_id, j]));

  // Totals come from the whole collection, not from the 25 rows shown below.
  // Deriving revenue from `recent` was wrong the moment the shop had more than
  // 25 orders, and wrong in the flattering direction — an under-reported total
  // reads as a quiet month rather than as a bug.
  const [totals] = await ordersCol
    .aggregate<{ revenue: number; paid: number; undelivered: number }>([
      { $match: { payment_status: "paid" } },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$amount" },
          paid: { $sum: 1 },
          undelivered: { $sum: { $cond: [{ $eq: ["$email_status", "failed"] }, 1, 0] } },
        },
      },
    ])
    .toArray();

  const revenue = totals?.revenue ?? 0;
  // The number that makes an incident legible. A creator does not read logs;
  // they notice that delivery is broken for a quarter of today's orders.
  const undelivered = totals?.undelivered ?? 0;

  // Checked per release so the creator learns a live release has no file from
  // their own screen, not from the first buyer whose download 500s.
  const assets = await Promise.all(
    catalogue.map(async (r) => [r.slug, await productAssetPresent(r.product_asset_key)] as const),
  );
  const assetFor = new Map(assets);
  const missingAssets = catalogue.filter((r) => assetFor.get(r.slug)?.ok === false);

  const sold = catalogue.reduce((n, r) => n + (r.quantity_total - r.quantity_remaining), 0);
  const remaining = catalogue.reduce((n, r) => n + r.quantity_remaining, 0);
  const liveCount = catalogue.filter((r) => r.status === "live").length;

  return (
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 96 }}>
      <p className="eyebrow">soft theory · dashboard</p>
      <h1 style={{ marginTop: 10, fontSize: 34 }}>All releases</h1>

      {bypass ? (
        <p className="banner-bad" style={{ marginTop: 20 }}>
          <strong>Not authenticated.</strong> Supabase auth is unconfigured, so
          this dashboard is open. Local development only — a production build
          refuses instead.
        </p>
      ) : (
        <p className="muted small" style={{ marginTop: 16 }}>
          Signed in as {creator?.email}.{" "}
          <form action={signOut} style={{ display: "inline" }}>
            <button className="linklike" type="submit">Sign out</button>
          </form>
        </p>
      )}

      {missingAssets.length > 0 ? (
        <p className="banner-bad" style={{ marginTop: 20 }}>
          <strong>
            {missingAssets.length} {missingAssets.length === 1 ? "release has" : "releases have"}{" "}
            no product file.
          </strong>{" "}
          {missingAssets.map((r) => r.title).join(", ")} — every download will
          fail with an error rather than a blank file. Run{" "}
          <code>pnpm asset:seed</code> locally, or <code>pnpm asset:push</code>{" "}
          for the deployed bucket.
        </p>
      ) : null}

      <div className="stats">
        <Stat label="Sold" value={String(sold)} />
        <Stat label="Remaining" value={String(remaining)} />
        <Stat label="Revenue" value={money(revenue)} />
        <Stat label="Live" value={`${liveCount} of ${catalogue.length}`} />
      </div>

      <h2 style={{ marginTop: 44, fontSize: 19 }}>Releases</h2>
      <div className="release-rows">
        {catalogue
          .slice()
          .sort((a, b) => a.title.localeCompare(b.title))
          .map((r) => (
            <div key={r.slug} className="release-row">
              <div style={{ minWidth: 0 }}>
                <p className="release-row-title">
                  <Link href={`/releases/${r.slug}`}>{r.title}</Link>
                  {assetFor.get(r.slug)?.ok === false ? (
                    <span className="pill pill-failed" style={{ marginLeft: 8 }}>no file</span>
                  ) : null}
                </p>
                <p className="muted small">
                  {r.quantity_total - r.quantity_remaining} of {r.quantity_total} sold ·{" "}
                  {money(r.price_amount, r.currency)}
                </p>
              </div>
              <ReleaseControls slug={r.slug} status={r.status} />
            </div>
          ))}
      </div>

      {undelivered > 0 ? (
        <p className="notice" role="status">
          <strong>{undelivered}</strong> paid {undelivered === 1 ? "order has" : "orders have"}{" "}
          not been delivered. The purchases are complete — the confirmation email
          failed. The provider&apos;s reason is on each row below.
        </p>
      ) : null}

      <h2 style={{ marginTop: 44, fontSize: 19 }}>Recent orders</h2>
      {recent.length === 0 ? (
        <p className="muted" style={{ marginTop: 12 }}>
          No orders yet. Buy something on the storefront, or run a demo scenario.
        </p>
      ) : (
        <table className="orders">
          <thead>
            <tr>
              <th>When</th><th>Customer</th><th>Amount</th><th>Payment</th><th>Delivery</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((o) => (
              <tr key={o.purchase_id}>
                <td className="muted">{ago(o.created_at)}</td>
                <td className="mono">{o.customer_email}</td>
                <td>{money(o.amount, o.currency)}</td>
                <td><span className={`pill pill-${o.payment_status}`}>{o.payment_status}</span></td>
                <td>
                  <span className={`pill pill-${o.email_status}`}>{o.email_status}</span>
                  {/* Retry state, so "failed" is distinguishable from "failed
                      and we have stopped trying". Those need different actions
                      from the creator, and conflating them is how a customer
                      waits forever for an email nobody is still sending. */}
                  {(() => {
                    const job = jobFor.get(o.purchase_id);
                    if (!job) return null;
                    if (job.status === "exhausted") {
                      return (
                        <div className="muted small" style={{ marginTop: 4 }}>
                          Gave up after {job.attempts} attempts.
                        </div>
                      );
                    }
                    if (job.status === "pending" && job.attempts > 0) {
                      return (
                        <div className="muted small" style={{ marginTop: 4 }}>
                          Retrying — attempt {job.attempts} of 4.
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {o.last_error ? (
                    <div className="muted small" style={{ marginTop: 4 }}>{o.last_error}</div>
                  ) : null}
                  {o.email_status !== "sent" ? (
                    <ResendButton purchaseId={o.purchase_id} />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
    </div>
  );
}
