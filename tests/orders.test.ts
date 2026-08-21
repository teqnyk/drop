import { beforeEach, describe, expect, it } from "vitest";
import { db, ensureIndexes, entitlements, orders, releases } from "@/lib/db";
import { completePurchase, hashToken, recordEmailOutcome } from "@/lib/orders";
import { reserveUnit } from "@/lib/inventory";
import { canonicalRelease } from "@/lib/fixture";

/**
 * Order creation, and the idempotency that makes webhook retries safe.
 *
 * Stripe retries. That is not an edge case, it is the delivery guarantee — so
 * "the same webhook arrives twice" is the normal case, and a second order is
 * the bug. PRD §12 requires a duplicate webhook cannot create a duplicate order.
 */
beforeEach(async () => {
  await (await db()).dropDatabase();
  await ensureIndexes();
  await (await releases()).insertOne(canonicalRelease());
});

async function purchase(reference = "cs_test_1") {
  const held = await reserveUnit("form-01");
  if (!held.ok) throw new Error("expected a reservation");
  return completePurchase({
    purchaseId: held.purchaseId,
    releaseSlug: "form-01",
    customerEmail: "buyer@example.invalid",
    paymentReference: reference,
    amount: 2900,
    currency: "usd",
    isDemo: true,
  });
}

describe("completing a purchase", () => {
  it("creates an order and a usable entitlement", async () => {
    const result = await purchase();

    expect(result.created).toBe(true);
    if (!result.created) return;
    expect(result.order.payment_status).toBe("paid");
    expect(result.order.email_status).toBe("pending");

    // The raw token is returned once and never stored — only its hash.
    const ent = await (await entitlements()).findOne({ purchase_id: result.order.purchase_id });
    expect(ent?.token_hash).toBe(hashToken(result.downloadToken));
    expect(ent?.token_hash).not.toBe(result.downloadToken);
  });

  it("a replayed webhook does NOT create a second order", async () => {
    const first = await purchase("cs_test_replay");
    if (!first.created) throw new Error("expected creation");

    const second = await completePurchase({
      purchaseId: first.order.purchase_id,
      releaseSlug: "form-01",
      customerEmail: "buyer@example.invalid",
      paymentReference: "cs_test_replay",
      amount: 2900,
      currency: "usd",
    });

    expect(second.created).toBe(false);
    expect(await (await orders()).countDocuments()).toBe(1);
  });

  it("survives two replays arriving at once", async () => {
    // The window a findOne-then-insert would leave open. The unique index has
    // no such window; this asserts we rely on it rather than on a check.
    const held = await reserveUnit("form-01");
    if (!held.ok) throw new Error("expected a reservation");

    const attempts = Array.from({ length: 5 }, () =>
      completePurchase({
        purchaseId: held.purchaseId,
        releaseSlug: "form-01",
        customerEmail: "buyer@example.invalid",
        paymentReference: "cs_test_race",
        amount: 2900,
        currency: "usd",
      }),
    );
    const results = await Promise.all(attempts);

    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(await (await orders()).countDocuments()).toBe(1);
  });

  it("converts the hold, so the sale is not returned to stock", async () => {
    const before = await (await releases()).findOne({ slug: "form-01" });
    await purchase("cs_test_convert");
    const after = await (await releases()).findOne({ slug: "form-01" });

    expect(after!.quantity_remaining).toBe(before!.quantity_remaining - 1);
  });
});

describe("email outcome", () => {
  it("a failed email keeps the order paid and records the provider's reason", async () => {
    // PRD §9: payment success survives a delivery failure, and the dashboard
    // must be able to say WHY — "failed" with no reason is only marginally
    // better than silence.
    const result = await purchase("cs_test_email");
    if (!result.created) throw new Error("expected creation");

    await recordEmailOutcome(result.order.purchase_id, {
      status: "failed",
      error: "Resend 422: domain not verified",
    });

    const stored = await (await orders()).findOne({ purchase_id: result.order.purchase_id });
    expect(stored?.payment_status).toBe("paid");
    expect(stored?.email_status).toBe("failed");
    expect(stored?.fulfilment_status).toBe("failed");
    expect(stored?.last_error).toContain("domain not verified");
  });

  it("distinguishes skipped from failed", async () => {
    // An unconfigured local environment is not a broken alert path, and must
    // not read as one.
    const result = await purchase("cs_test_skip");
    if (!result.created) throw new Error("expected creation");

    await recordEmailOutcome(result.order.purchase_id, { status: "skipped" });

    const stored = await (await orders()).findOne({ purchase_id: result.order.purchase_id });
    expect(stored?.email_status).toBe("skipped");
  });
});
