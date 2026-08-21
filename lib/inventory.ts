import { randomUUID } from "node:crypto";
import { releases, reservations } from "./db";
import type { Release, Reservation } from "./types";

/** How long a checkout may hold a unit before it returns to stock. */
export const RESERVATION_TTL_MS = 15 * 60 * 1000;

export type ReserveResult =
  | { ok: true; purchaseId: string; release: Release }
  | { ok: false; reason: "sold_out" | "not_live" | "closed" };

/**
 * Hold one unit of a release.
 *
 * The decrement is a SINGLE guarded update, never a read followed by a write:
 *
 *   findOneAndUpdate({ slug, quantity_remaining: { $gt: 0 } }, { $inc: -1 })
 *
 * MongoDB applies single-document updates atomically, so the guard and the
 * decrement cannot separate. That is what makes §12's "inventory can never go
 * negative" true under the launch-day burst Drop exists to simulate — and a
 * null result IS the sold-out answer, not an error to retry.
 *
 * The status and closing-time checks are inside the same predicate on purpose.
 * Checking them first in JavaScript would reopen the race they exist to close:
 * a release paused between the check and the update would still sell a copy.
 */
export async function reserveUnit(slug: string): Promise<ReserveResult> {
  const col = await releases();
  const now = new Date().toISOString();

  const held = await col.findOneAndUpdate(
    {
      slug,
      status: "live",
      quantity_remaining: { $gt: 0 },
      $or: [{ closes_at: null }, { closes_at: { $gt: now } }],
    },
    { $inc: { quantity_remaining: -1 } },
    { returnDocument: "after" },
  );

  if (!held) {
    // Distinguish the reasons for the customer's sake — "sold out" and "this
    // release is paused" are different sentences, and a storefront that says
    // the wrong one loses a sale it could have kept.
    const release = await col.findOne({ slug });
    if (!release) return { ok: false, reason: "not_live" };

    // Order matters, and getting it wrong is not cosmetic. Selling the last
    // unit sets status to "sold_out", so a `status !== "live"` check placed
    // first reports a sold-out release as PAUSED — telling the customer to come
    // back later for something that is gone, and telling the creator nothing
    // useful. Sold out is decided by stock, before status is consulted at all.
    if (release.quantity_remaining <= 0 || release.status === "sold_out") {
      return { ok: false, reason: "sold_out" };
    }
    if (release.closes_at && release.closes_at <= now) return { ok: false, reason: "closed" };
    if (release.status !== "live") return { ok: false, reason: "not_live" };
    return { ok: false, reason: "sold_out" };
  }

  // Mark it sold out once the last unit leaves, so the storefront says so
  // without recomputing it on every render.
  if (held.quantity_remaining === 0) {
    await col.updateOne({ slug, quantity_remaining: 0 }, { $set: { status: "sold_out" } });
  }

  const purchaseId = randomUUID();
  const reservation: Reservation = {
    purchase_id: purchaseId,
    release_slug: slug,
    customer_email: null,
    status: "held",
    expires_at: new Date(Date.now() + RESERVATION_TTL_MS),
    created_at: now,
  };
  await (await reservations()).insertOne(reservation);

  return { ok: true, purchaseId, release: held };
}

/**
 * Return a held unit to stock.
 *
 * Guarded on the reservation still being `held`, so a double release — an
 * expiry racing an explicit cancel — cannot put the unit back twice and
 * inflate the edition beyond `quantity_total`.
 */
export async function releaseUnit(purchaseId: string): Promise<boolean> {
  const res = await reservations();
  const claimed = await res.findOneAndUpdate(
    { purchase_id: purchaseId, status: "held" },
    { $set: { status: "released" } },
    { returnDocument: "after" },
  );
  if (!claimed) return false;

  await (await releases()).updateOne(
    { slug: claimed.release_slug },
    {
      $inc: { quantity_remaining: 1 },
      // Coming back from sold out is the point of releasing a hold.
      $set: { status: "live" },
    },
  );
  return true;
}

/** Convert a hold into a sale. Idempotent: converting twice is a no-op. */
export async function convertReservation(purchaseId: string): Promise<boolean> {
  const res = await reservations();
  const claimed = await res.findOneAndUpdate(
    { purchase_id: purchaseId, status: "held" },
    { $set: { status: "converted" } },
  );
  return Boolean(claimed);
}
