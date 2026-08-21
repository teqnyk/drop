import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Stripe, over `fetch`.
 *
 * Deliberately not the SDK: Drop runs on Workers, the surface used here is two
 * calls, and the signature verification below is the one piece worth being able
 * to read in full rather than trusting.
 */
const API = "https://api.stripe.com/v1";

export type CheckoutSession = { id: string; url: string };

export async function createCheckoutSession(input: {
  purchaseId: string;
  releaseTitle: string;
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSession> {
  const form = new URLSearchParams({
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": input.currency,
    "line_items[0][price_data][unit_amount]": String(input.amount),
    "line_items[0][price_data][product_data][name]": input.releaseTitle,
    // The thread that ties Stripe's record to Drop's, and to the trace Beaam
    // collects. Without it, reconciling a payment to an order means matching on
    // email and timestamp, which is guesswork wearing a suit.
    "metadata[purchase_id]": input.purchaseId,
    "payment_intent_data[metadata][purchase_id]": input.purchaseId,
  });

  const res = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.stripeSecret()}`,
      "content-type": "application/x-www-form-urlencoded",
      // Stripe deduplicates on this, so a double-submitted buy button cannot
      // create two sessions for one reservation.
      "Idempotency-Key": `checkout_${input.purchaseId}`,
    },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().then((t) => t.slice(0, 300)).catch(() => "");
    throw new Error(`Stripe refused the checkout session (HTTP ${res.status}): ${detail}`);
  }

  const body = (await res.json()) as { id?: string; url?: string };
  if (!body.id || !body.url) {
    // An unreadable success is a failure. Returning a half-built session here
    // would send the customer to `undefined`.
    throw new Error("Stripe returned a session without an id or url.");
  }
  return { id: body.id, url: body.url };
}

/**
 * Verify a webhook signature.
 *
 * This is the load-bearing security check in the whole application. PRD §8:
 * "A browser redirect must never be treated as proof of payment." The redirect
 * only means the customer's browser came back — anyone can visit that URL. Only
 * a correctly signed webhook means Stripe took the money, so an unsigned or
 * mis-signed request must be refused rather than trusted.
 *
 * Implements Stripe's scheme: sign `${timestamp}.${rawBody}` with the endpoint
 * secret, compare against the `v1=` signature, and reject anything outside the
 * tolerance window so a captured payload cannot be replayed indefinitely.
 */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export type VerifyResult =
  | { ok: true; event: StripeEvent }
  | { ok: false; reason: string };

export type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

export function verifyWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): VerifyResult {
  if (!signatureHeader) return { ok: false, reason: "no stripe-signature header" };

  const parts = new Map(
    signatureHeader.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")] as const;
    }),
  );

  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature) return { ok: false, reason: "malformed stripe-signature" };

  const age = Math.abs(nowSeconds - Number(timestamp));
  if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: `timestamp outside tolerance (${age}s)` };
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  // Constant-time: a fast-failing comparison leaks how much of a forged
  // signature was correct, one byte at a time.
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature mismatch" };
  }

  try {
    return { ok: true, event: JSON.parse(rawBody) as StripeEvent };
  } catch {
    return { ok: false, reason: "signed body was not JSON" };
  }
}
