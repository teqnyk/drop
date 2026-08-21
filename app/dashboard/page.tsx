import { orders, releases } from "@/lib/db";
import { configured } from "@/lib/env";
import { fulfilmentJobs } from "@/lib/fulfilment";
import { ReleaseControls, ResendButton } from "./controls";

export const dynamic = "force-dynamic";

/**
 * The creator dashboard (PRD §8).
 *
 * Deliberately small. Its job is not to be an analytics product — it is to give
 * an incident a business consequence on screen. Before this page exists, a demo
 * can only show telemetry; with it, "payments are failing" becomes "eleven
 * people tried to buy and four got through".
 *
 * Not authenticated yet — Supabase auth arrives with the release-management
 * work. It reads nothing secret today, and the gap is stated rather than
 * papered over with a token in a query string.
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

  const release = await (await releases()).findOne({ slug: "form-01" });
  const recent = await (await orders()).find({}).sort({ created_at: -1 }).limit(25).toArray();
  const jobs = await (await fulfilmentJobs())
    .find({ purchase_id: { $in: recent.map((o) => o.purchase_id) } })
    .toArray();
  const jobFor = new Map(jobs.map((j) => [j.purchase_id, j]));
  const paid = recent.filter((o) => o.payment_status === "paid");
  const revenue = paid.reduce((sum, o) => sum + o.amount, 0);

  // The number that makes an incident legible. A creator does not read logs;
  // they notice that delivery is broken for a quarter of today's orders.
  const undelivered = paid.filter((o) => o.email_status === "failed").length;

  return (
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 96 }}>
      <p className="eyebrow">soft theory · dashboard</p>
      <h1 style={{ marginTop: 10, fontSize: 34 }}>{release?.title ?? "No release"}</h1>

      {release ? <ReleaseControls slug={release.slug} status={release.status} /> : null}

      <div className="stats">
        <Stat label="Sold" value={String((release?.quantity_total ?? 0) - (release?.quantity_remaining ?? 0))} />
        <Stat label="Remaining" value={String(release?.quantity_remaining ?? 0)} />
        <Stat label="Revenue" value={money(revenue)} />
        <Stat label="Status" value={release?.status ?? "—"} />
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
