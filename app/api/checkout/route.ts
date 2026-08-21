import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { env, configured } from "@/lib/env";
import { releaseUnit, reserveUnit } from "@/lib/inventory";
import { createCheckoutSession } from "@/lib/stripe";
import { deviceKind, recordEvent, referrerHost } from "@/lib/events";
import { activeScenario, scenarioDelay } from "@/lib/scenarios";
import { emitAsync, metrics } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

const SOLD_OUT = "That was the last copy — this edition is sold out.";
const NOT_LIVE = "This release isn't on sale right now.";
const CLOSED = "This release has closed.";

/**
 * Start a purchase.
 *
 * Order matters: reserve FIRST, then create the payment session. The reverse
 * would take a customer's money for a unit that might already be gone. If
 * Stripe then fails, the hold is returned immediately rather than left to
 * expire — a customer who sees an error should not also find the edition one
 * copy smaller for fifteen minutes.
 */
export async function POST(request: Request) {
  if (!configured.mongo() || !configured.stripe()) {
    return NextResponse.json(
      { error: "Checkout isn't configured in this environment." },
      { status: 503 },
    );
  }

  const started = Date.now();
  const { slug } = (await request.json().catch(() => ({}))) as { slug?: string };
  if (!slug) return NextResponse.json({ error: "No release specified." }, { status: 400 });

  const h = await headers();
  const context = {
    releaseSlug: slug,
    referrer: referrerHost(h.get("referer")),
    device: deviceKind(h.get("user-agent")),
  };

  // Demo latency is applied to the real path, not simulated around it, so the
  // slowness shows up in telemetry exactly as a genuine slowdown would.
  await scenarioDelay("slow_checkout");

  const held = await reserveUnit(slug);
  if (!held.ok) {
    await recordEvent({
      ...context,
      type: "payment_failed",
      checkout: { latency_ms: Date.now() - started, failure_reason: held.reason },
    });
    emitAsync(metrics.checkoutFailed(held.reason, { release: slug }));
    const message =
      held.reason === "sold_out" ? SOLD_OUT : held.reason === "closed" ? CLOSED : NOT_LIVE;
    return NextResponse.json({ error: message }, { status: 409 });
  }

  await recordEvent({
    ...context,
    type: "checkout_started",
    purchaseId: held.purchaseId,
    checkout: { latency_ms: Date.now() - started },
  });
  emitAsync([
    ...metrics.checkoutStarted(Date.now() - started, {
      release: slug,
      // The thread. One purchase_id in Drop, in this metric, in the event
      // documents and on the Stripe session — so a presenter can paste one id
      // into any of them and see the same purchase.
      "drop.purchase_id": held.purchaseId,
    }),
    ...metrics.inventoryRemaining(held.release.quantity_remaining, { release: slug }),
  ]);

  // The payment-failure scenario refuses BEFORE Stripe is called, so no real
  // session exists to reconcile later, and the hold is returned at once.
  if (await activeScenario("payment_failure")) {
    await releaseUnit(held.purchaseId);
    await recordEvent({
      ...context,
      type: "payment_failed",
      purchaseId: held.purchaseId,
      checkout: { latency_ms: Date.now() - started, failure_reason: "card_declined" },
    });
    emitAsync(metrics.checkoutFailed("card_declined", {
      release: slug,
      "drop.purchase_id": held.purchaseId,
    }));
    return NextResponse.json(
      { error: "Your payment was declined. No charge was made — please try another card." },
      { status: 402 },
    );
  }

  try {
    const site = env.siteUrl();
    const session = await createCheckoutSession({
      purchaseId: held.purchaseId,
      releaseTitle: `${held.release.studio_name} — ${held.release.title}`,
      amount: held.release.price_amount,
      currency: held.release.currency,
      successUrl: `${site}/thanks?purchase=${held.purchaseId}`,
      cancelUrl: `${site}/?cancelled=1`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    // Give the unit back now. Leaving it held would shrink the edition for
    // fifteen minutes because of OUR failure, which the customer would see as
    // the product selling out.
    await releaseUnit(held.purchaseId);

    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[checkout] ${held.purchaseId}: ${reason}`);
    await recordEvent({
      ...context,
      type: "payment_failed",
      purchaseId: held.purchaseId,
      checkout: { latency_ms: Date.now() - started, failure_reason: "session_create_failed" },
    });
    emitAsync(metrics.checkoutFailed("session_create_failed", {
      release: slug,
      "drop.purchase_id": held.purchaseId,
    }));
    return NextResponse.json(
      { error: "Couldn't start checkout. Nothing was charged — please try again." },
      { status: 502 },
    );
  }
}
