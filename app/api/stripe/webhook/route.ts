import { NextResponse } from "next/server";
import { env, configured } from "@/lib/env";
import { verifyWebhook } from "@/lib/stripe";
import { completePurchase, recordEmailOutcome, releaseTitle } from "@/lib/orders";
import { releaseUnit } from "@/lib/inventory";
import { sendConfirmation } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Stripe's webhook — the only thing that creates an order.
 *
 * PRD §8: "A browser redirect must never be treated as proof of payment."
 * `/thanks` is a page anyone can visit; this endpoint is the one that has
 * cryptographic evidence Stripe took money.
 *
 * The raw body is read as text BEFORE parsing, because the signature covers the
 * exact bytes Stripe sent — reparsing and re-serialising changes them and every
 * signature fails for reasons that look like a wrong secret.
 */
export async function POST(request: Request) {
  if (!configured.stripe() || !configured.mongo()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const raw = await request.text();
  const verified = verifyWebhook(
    raw,
    request.headers.get("stripe-signature"),
    env.stripeWebhookSecret(),
  );

  if (!verified.ok) {
    // 400, not 500: this is a rejected request, not a broken server. A 500
    // tells Stripe to retry forever something that will never be accepted.
    console.warn(`[webhook] refused: ${verified.reason}`);
    return NextResponse.json({ error: verified.reason }, { status: 400 });
  }

  const event = verified.event;
  const object = event.data.object as Record<string, unknown>;
  const purchaseId = (object.metadata as Record<string, string> | undefined)?.purchase_id;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        if (!purchaseId) {
          // Nothing to reconcile against. Accept it so Stripe stops retrying,
          // but say so loudly — a session without our id means the checkout
          // route stopped attaching metadata.
          console.error(`[webhook] ${event.id}: no purchase_id in metadata`);
          return NextResponse.json({ received: true, ignored: "no purchase_id" });
        }

        const email =
          (object.customer_details as { email?: string } | undefined)?.email ??
          (object.customer_email as string | undefined) ??
          "unknown@example.invalid";

        const result = await completePurchase({
          purchaseId,
          releaseSlug: "form-01",
          customerEmail: email,
          paymentReference: String(object.id),
          amount: Number(object.amount_total ?? 0),
          currency: String(object.currency ?? "usd"),
          isDemo: true,
        });

        if (!result.created) {
          // A replay. The unique index did its job; this is success.
          return NextResponse.json({ received: true, duplicate: true });
        }

        const title = await releaseTitle(result.order.release_slug);
        const outcome = await sendConfirmation({
          to: email,
          releaseTitle: title,
          downloadUrl: `${env.siteUrl()}/download/${result.downloadToken}`,
        });

        await recordEmailOutcome(
          purchaseId,
          outcome.sent
            ? { status: "sent" }
            : {
                status: outcome.reason.startsWith("skipped") ? "skipped" : "failed",
                error: outcome.reason,
              },
        );

        return NextResponse.json({ received: true });
      }

      case "checkout.session.expired": {
        // The customer walked away. Give the unit back rather than waiting for
        // the TTL, so the edition is accurate on the storefront sooner.
        if (purchaseId) await releaseUnit(purchaseId);
        return NextResponse.json({ received: true });
      }

      default:
        return NextResponse.json({ received: true, ignored: event.type });
    }
  } catch (error) {
    // A 500 here is correct: Stripe should retry, because the payment is real
    // and the order is not yet recorded. The log carries the reason so the
    // retry is not a mystery.
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[webhook] ${event.id} (${event.type}) failed: ${reason}`);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
