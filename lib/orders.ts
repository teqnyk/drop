import { createHash, randomBytes } from "node:crypto";
import { entitlements, orders, releases } from "./db";
import { convertReservation } from "./inventory";
import { recordEvent } from "./events";
import type { Order } from "./types";

export const ENTITLEMENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type CompleteResult =
  | { created: true; order: Order; downloadToken: string }
  | { created: false; reason: "duplicate"; order: Order };

/**
 * Turn a confirmed payment into an order plus a download entitlement.
 *
 * **Idempotent by index, not by check.** The unique index on
 * `payment_reference` is what makes a replayed webhook safe: the second insert
 * fails with a duplicate-key error, which is the correct outcome and is handled
 * as success. A `findOne`-then-`insert` would leave a window between the two
 * where a concurrent replay creates a second order — and webhook replays are
 * not hypothetical, they are how Stripe retries.
 */
export async function completePurchase(input: {
  purchaseId: string;
  releaseSlug: string;
  customerEmail: string;
  paymentReference: string;
  amount: number;
  currency: string;
  isDemo?: boolean;
}): Promise<CompleteResult> {
  const col = await orders();
  const now = new Date().toISOString();

  const order: Order = {
    purchase_id: input.purchaseId,
    release_slug: input.releaseSlug,
    reservation_id: input.purchaseId,
    customer_email: input.customerEmail,
    payment_reference: input.paymentReference,
    payment_status: "paid",
    fulfilment_status: "pending",
    email_status: "pending",
    last_error: null,
    amount: input.amount,
    currency: input.currency,
    is_demo: input.isDemo ?? false,
    created_at: now,
    completed_at: now,
  };

  try {
    await col.insertOne(order);
  } catch (error) {
    if (isDuplicateKey(error)) {
      const existing = await col.findOne({ payment_reference: input.paymentReference });
      if (existing) return { created: false, reason: "duplicate", order: existing };
    }
    throw error;
  }

  await convertReservation(input.purchaseId);

  // The raw token is returned once, emailed, and never stored — only its hash.
  const token = randomBytes(32).toString("base64url");
  await (await entitlements()).insertOne({
    purchase_id: input.purchaseId,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + ENTITLEMENT_TTL_MS),
    download_count: 0,
    last_downloaded_at: null,
    created_at: now,
  });

  await recordEvent({
    type: "purchase_completed",
    releaseSlug: input.releaseSlug,
    purchaseId: input.purchaseId,
    isDemo: input.isDemo,
  });

  return { created: true, order, downloadToken: token };
}

function isDuplicateKey(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code: unknown }).code === 11000);
}

/**
 * Record what happened to the confirmation email.
 *
 * A failure is stored with the provider's own words. PRD §9: "A failed email
 * must never look successful" — and a dashboard that says "failed" without
 * saying why is only marginally better, because the creator still cannot act.
 */
export async function recordEmailOutcome(
  purchaseId: string,
  outcome: { status: "sent" | "failed" | "skipped"; error?: string },
): Promise<void> {
  await (await orders()).updateOne(
    { purchase_id: purchaseId },
    {
      $set: {
        email_status: outcome.status,
        fulfilment_status: outcome.status === "sent" ? "delivered" : "failed",
        last_error: outcome.error ? outcome.error.slice(0, 500) : null,
      },
    },
  );
}

export async function releaseTitle(slug: string): Promise<string> {
  const release = await (await releases()).findOne({ slug });
  return release ? `${release.studio_name} — ${release.title}` : slug;
}
