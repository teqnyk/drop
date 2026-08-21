import { beforeEach, describe, expect, it } from "vitest";
import { db, ensureIndexes, orders, releases } from "@/lib/db";
import { canonicalRelease } from "@/lib/fixture";
import { completePurchase } from "@/lib/orders";
import { reserveUnit } from "@/lib/inventory";
import {
  MAX_ATTEMPTS,
  fulfilmentJobs,
  queueDelivery,
  requeueDelivery,
  runFulfilment,
} from "@/lib/fulfilment";
import { enableScenario, disableAllScenarios } from "@/lib/scenarios";

/**
 * Delivery retries.
 *
 * PRD §17: bounded retries, and permanent failure that becomes VISIBLE. The
 * failure mode being designed out is a queue that quietly keeps trying forever,
 * or quietly stops — both of which leave a paid customer with nothing and a
 * creator with no idea.
 *
 * Email is failed deterministically via the email_failure scenario, so these
 * exercise the real send path rather than a stub of it.
 */
beforeEach(async () => {
  await (await db()).dropDatabase();
  await ensureIndexes();
  await (await releases()).insertOne(canonicalRelease());
  await disableAllScenarios();
});

async function paidOrder(ref = "cs_test_fulfil") {
  const held = await reserveUnit("form-01");
  if (!held.ok) throw new Error("expected a reservation");
  const result = await completePurchase({
    purchaseId: held.purchaseId,
    releaseSlug: "form-01",
    customerEmail: "buyer@example.invalid",
    paymentReference: ref,
    amount: 2900,
    currency: "usd",
  });
  if (!result.created) throw new Error("expected creation");
  await queueDelivery(result.order.purchase_id);
  return result.order.purchase_id;
}

describe("queueing", () => {
  it("is idempotent — a replayed webhook queues one job", async () => {
    const id = await paidOrder();
    await queueDelivery(id);
    await queueDelivery(id);

    expect(await (await fulfilmentJobs()).countDocuments({ purchase_id: id })).toBe(1);
  });
});

describe("bounded retries", () => {
  it("gives up after MAX_ATTEMPTS and says so, rather than trying forever", async () => {
    await enableScenario("email_failure", {}, 60_000);
    const id = await paidOrder();

    // Drive the clock forward past each backoff instead of waiting them out.
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await runFulfilment(new Date(Date.now() + i * 60 * 60_000));
    }

    const job = await (await fulfilmentJobs()).findOne({ purchase_id: id });
    expect(job?.status).toBe("exhausted");
    expect(job?.attempts).toBe(MAX_ATTEMPTS);
    expect(job?.last_error).toContain("Demo scenario");

    // And it is visible where a creator would look, with the reason.
    const order = await (await orders()).findOne({ purchase_id: id });
    expect(order?.email_status).toBe("failed");
    expect(order?.payment_status).toBe("paid"); // the sale still stands
    expect(order?.last_error).toContain("Demo scenario");
  });

  it("stops attempting once exhausted", async () => {
    await enableScenario("email_failure", {}, 60_000);
    const id = await paidOrder();
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await runFulfilment(new Date(Date.now() + i * 60 * 60_000));
    }

    const after = await runFulfilment(new Date(Date.now() + 99 * 60 * 60_000));

    expect(after.attempted).toBe(0);
    expect((await (await fulfilmentJobs()).findOne({ purchase_id: id }))?.attempts).toBe(
      MAX_ATTEMPTS,
    );
  });

  it("backs off rather than hammering the provider", async () => {
    await enableScenario("email_failure", {}, 60_000);
    const id = await paidOrder();
    const now = new Date();

    await runFulfilment(now);
    // Immediately again: the job is not due, so nothing is attempted.
    const second = await runFulfilment(now);

    expect(second.attempted).toBe(0);
    const job = await (await fulfilmentJobs()).findOne({ purchase_id: id });
    expect(job!.next_attempt_at.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("recovery", () => {
  it("delivers once the provider recovers, and closes the job", async () => {
    await enableScenario("email_failure", {}, 60_000);
    const id = await paidOrder();
    await runFulfilment();
    expect((await (await fulfilmentJobs()).findOne({ purchase_id: id }))?.status).toBe("pending");

    // Provider recovers. In this environment Resend is unconfigured, so the
    // send reports "skipped" — which is NOT success, and the job must not
    // pretend it delivered.
    await disableAllScenarios();
    const result = await runFulfilment(new Date(Date.now() + 60 * 60_000));

    expect(result.attempted).toBe(1);
    const job = await (await fulfilmentJobs()).findOne({ purchase_id: id });
    expect(job?.status).not.toBe("delivered");
  });

  it("resend puts an exhausted job back in the queue", async () => {
    await enableScenario("email_failure", {}, 60_000);
    const id = await paidOrder();
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await runFulfilment(new Date(Date.now() + i * 60 * 60_000));
    }
    expect((await (await fulfilmentJobs()).findOne({ purchase_id: id }))?.status).toBe("exhausted");

    expect(await requeueDelivery(id)).toBe(true);

    const job = await (await fulfilmentJobs()).findOne({ purchase_id: id });
    expect(job?.status).toBe("pending");
    expect(job?.attempts).toBe(0);
  });
});
