import { orders } from "@/lib/db";
import { configured } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * The confirmation page.
 *
 * Reads the ORDER, and an order only exists once the signed webhook created it.
 * So this page cannot be faked by visiting the URL: an unknown purchase id
 * shows "we haven't seen this payment yet" rather than a receipt. That is the
 * customer-facing half of "a redirect is not proof of payment".
 */
export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: string }>;
}) {
  const { purchase } = await searchParams;

  if (!purchase || !configured.mongo()) return <Pending />;

  const order = await (await orders()).findOne({ purchase_id: purchase });
  if (!order) return <Pending />;

  return (
    <main className="wrap" style={{ paddingTop: 64, paddingBottom: 96, maxWidth: 620 }}>
      <p className="eyebrow">order confirmed</p>
      <h1 style={{ marginTop: 12, fontSize: 38 }}>Thank you.</h1>
      <p className="lede" style={{ fontSize: 17 }}>
        Your copy is on its way to <strong>{order.customer_email}</strong>.
      </p>

      {/* Email state is reported honestly, including when it went wrong. The
          purchase is still complete and the download still works — saying
          otherwise, or saying nothing, is how a working order looks broken. */}
      {order.email_status === "failed" ? (
        <p className="notice" role="status">
          We couldn&apos;t send your confirmation email just yet. Your purchase is
          complete and we&apos;re retrying — contact us if it doesn&apos;t arrive.
        </p>
      ) : order.email_status === "skipped" ? (
        <p className="notice" role="status">
          Email isn&apos;t configured in this environment, so no confirmation was
          sent. The purchase itself completed.
        </p>
      ) : null}

      <dl className="receipt">
        <div><dt>Reference</dt><dd className="mono">{order.purchase_id.slice(0, 8)}</dd></div>
        <div><dt>Amount</dt><dd>${(order.amount / 100).toFixed(2)}</dd></div>
        <div><dt>Status</dt><dd>{order.payment_status}</dd></div>
      </dl>
    </main>
  );
}

function Pending() {
  return (
    <main className="wrap" style={{ paddingTop: 64, maxWidth: 620 }}>
      <p className="eyebrow">payment pending</p>
      <h1 style={{ marginTop: 12, fontSize: 34 }}>We haven&apos;t seen this payment yet.</h1>
      <p className="lede" style={{ fontSize: 17 }}>
        Payments are confirmed by the payment provider, not by your browser
        arriving here — so this page waits for that confirmation rather than
        assuming it. If you completed a payment, refresh in a moment.
      </p>
      <p style={{ marginTop: 28 }}>
        <a href="/">Back to the store</a>
      </p>
    </main>
  );
}
