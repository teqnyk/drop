import { db, orders } from "./db";
import { sendConfirmation } from "./email";
import { recordEmailOutcome, releaseTitle } from "./orders";
import { entitlements } from "./db";
import { randomBytes } from "node:crypto";
import { hashToken, ENTITLEMENT_TTL_MS } from "./orders";
import { env } from "./env";
import { emitAsync, metrics } from "./telemetry";
import type { Collection } from "mongodb";

/**
 * Delivery retries (PRD §17: "background retries are bounded; permanent
 * failures become visible").
 *
 * A queue rather than a retry loop inside the webhook, because the webhook must
 * answer Stripe quickly and a payment that succeeded must not be retried
 * because an email failed. So delivery is a separate, resumable job.
 *
 * The two rules that matter:
 *
 *  - **Bounded.** After MAX_ATTEMPTS the job stops and is marked `exhausted`.
 *    An unbounded retry is how a broken provider becomes a bill, and how a
 *    permanent failure hides forever behind "it'll get there".
 *  - **Visible when it gives up.** Exhaustion is a state the dashboard shows
 *    with the last provider error, not a silent stop. A queue that quietly
 *    abandons work is the exact failure this application argues against.
 */
export const MAX_ATTEMPTS = 4;

/** Exponential-ish backoff, in ms, indexed by attempts already made. */
const BACKOFF_MS = [0, 30_000, 2 * 60_000, 10 * 60_000];

export type FulfilmentJob = {
  purchase_id: string;
  status: "pending" | "delivered" | "exhausted";
  attempts: number;
  next_attempt_at: Date;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export async function fulfilmentJobs(): Promise<Collection<FulfilmentJob>> {
  return (await db()).collection<FulfilmentJob>("fulfilment_jobs");
}

/** Queue a delivery. Idempotent — a replayed webhook must not queue twice. */
export async function queueDelivery(purchaseId: string): Promise<void> {
  const jobs = await fulfilmentJobs();
  const now = new Date();
  await jobs.updateOne(
    { purchase_id: purchaseId },
    {
      $setOnInsert: {
        purchase_id: purchaseId,
        status: "pending",
        attempts: 0,
        next_attempt_at: now,
        last_error: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    },
    { upsert: true },
  );
}

export type RunResult = {
  attempted: number;
  delivered: number;
  retrying: number;
  exhausted: number;
};

/**
 * Work the queue once.
 *
 * Called by a scheduled trigger in production and directly in tests. Claims
 * each job with a guarded update before doing the work, so two overlapping runs
 * cannot both send the same confirmation — the customer noticing is a duplicate
 * email, which is a small failure with an embarrassing shape.
 */
export async function runFulfilment(now: Date = new Date()): Promise<RunResult> {
  const jobs = await fulfilmentJobs();
  const result: RunResult = { attempted: 0, delivered: 0, retrying: 0, exhausted: 0 };

  const due = await jobs
    .find({ status: "pending", next_attempt_at: { $lte: now } })
    .limit(25)
    .toArray();

  for (const job of due) {
    // Claim it: move the next attempt out of the way before working, so a
    // concurrent run skips it rather than duplicating the send.
    const claimed = await jobs.findOneAndUpdate(
      { purchase_id: job.purchase_id, status: "pending", attempts: job.attempts },
      {
        $inc: { attempts: 1 },
        $set: {
          next_attempt_at: new Date(now.getTime() + 5 * 60_000),
          updated_at: now.toISOString(),
        },
      },
      { returnDocument: "after" },
    );
    if (!claimed) continue;

    result.attempted += 1;
    const outcome = await attemptDelivery(job.purchase_id);

    if (outcome.sent) {
      await jobs.updateOne(
        { purchase_id: job.purchase_id },
        { $set: { status: "delivered", last_error: null, updated_at: now.toISOString() } },
      );
      await recordEmailOutcome(job.purchase_id, { status: "sent" });
      emitAsync(metrics.emailOutcome("sent", { "drop.purchase_id": job.purchase_id }));
      result.delivered += 1;
      continue;
    }

    const attempts = claimed.attempts;
    if (attempts >= MAX_ATTEMPTS) {
      // Give up — loudly. The order keeps its provider error and the dashboard
      // shows it; the creator can resend by hand.
      await jobs.updateOne(
        { purchase_id: job.purchase_id },
        { $set: { status: "exhausted", last_error: outcome.reason, updated_at: now.toISOString() } },
      );
      await recordEmailOutcome(job.purchase_id, { status: "failed", error: outcome.reason });
      emitAsync(metrics.emailOutcome("exhausted", { "drop.purchase_id": job.purchase_id }));
      result.exhausted += 1;
      continue;
    }

    const backoff = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];
    await jobs.updateOne(
      { purchase_id: job.purchase_id },
      {
        $set: {
          next_attempt_at: new Date(now.getTime() + backoff),
          last_error: outcome.reason,
          updated_at: now.toISOString(),
        },
      },
    );
    await recordEmailOutcome(job.purchase_id, { status: "failed", error: outcome.reason });
    result.retrying += 1;
  }

  return result;
}

/** Send the confirmation for one order, minting a fresh download link. */
async function attemptDelivery(
  purchaseId: string,
): Promise<{ sent: true } | { sent: false; reason: string }> {
  const order = await (await orders()).findOne({ purchase_id: purchaseId });
  if (!order) return { sent: false, reason: "order not found" };

  // A resend needs a working link, and the old raw token is unrecoverable by
  // design — only its hash was kept. So mint a new entitlement and let the old
  // one stand: two valid links for one purchase is harmless, a dead link in the
  // customer's inbox is not.
  const token = randomBytes(32).toString("base64url");
  await (await entitlements()).insertOne({
    purchase_id: purchaseId,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + ENTITLEMENT_TTL_MS),
    download_count: 0,
    last_downloaded_at: null,
    created_at: new Date().toISOString(),
  });

  const outcome = await sendConfirmation({
    to: order.customer_email,
    releaseTitle: await releaseTitle(order.release_slug),
    downloadUrl: `${env.siteUrl()}/download/${token}`,
  });

  return outcome.sent ? { sent: true } : { sent: false, reason: outcome.reason };
}

/** Put an exhausted job back in the queue — the creator's "resend" action. */
export async function requeueDelivery(purchaseId: string): Promise<boolean> {
  const jobs = await fulfilmentJobs();
  const updated = await jobs.findOneAndUpdate(
    { purchase_id: purchaseId },
    {
      $set: {
        status: "pending",
        attempts: 0,
        next_attempt_at: new Date(),
        updated_at: new Date().toISOString(),
      },
    },
  );
  return Boolean(updated);
}
