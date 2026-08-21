import { MongoClient, type Db, type Collection } from "mongodb";
import { env } from "./env";
import type {
  DemoScenario,
  Entitlement,
  Order,
  Release,
  Reservation,
  StorefrontEvent,
} from "./types";

/**
 * MongoDB Atlas — Drop's only database (PRD §14).
 *
 * One client per process, reused. The driver pools connections itself; making
 * a new client per request exhausts Atlas's connection limit under exactly the
 * launch-day burst Drop exists to simulate.
 */
let clientPromise: Promise<MongoClient> | null = null;

function client(): Promise<MongoClient> {
  if (!clientPromise) {
    clientPromise = new MongoClient(env.mongoUri(), {
      // A demo that hangs is worse than one that fails: a stuck request looks
      // like a slow app rather than a missing database, and sends whoever is
      // watching to the wrong screen.
      serverSelectionTimeoutMS: 5_000,
    }).connect();
  }
  return clientPromise;
}

export async function db(): Promise<Db> {
  return (await client()).db(env.mongoDb());
}

export async function releases(): Promise<Collection<Release>> {
  return (await db()).collection<Release>("releases");
}
export async function reservations(): Promise<Collection<Reservation>> {
  return (await db()).collection<Reservation>("reservations");
}
export async function orders(): Promise<Collection<Order>> {
  return (await db()).collection<Order>("orders");
}
export async function entitlements(): Promise<Collection<Entitlement>> {
  return (await db()).collection<Entitlement>("entitlements");
}
export async function storefrontEvents(): Promise<Collection<StorefrontEvent>> {
  return (await db()).collection<StorefrontEvent>("storefront_events");
}
export async function demoScenarios(): Promise<Collection<DemoScenario>> {
  return (await db()).collection<DemoScenario>("demo_scenarios");
}

/**
 * The indexes that enforce Drop's invariants.
 *
 * These are not performance tuning — they are where §12's guarantees actually
 * live. Application code cannot be trusted to keep them:
 *
 *  - unique `payment_reference` makes webhook handling idempotent, so a
 *    replayed webhook fails the insert instead of creating a second order;
 *  - TTL on `reservations.expires_at` returns abandoned stock with no sweeper;
 *  - unique `entitlements.token_hash` stops two orders sharing a download.
 *
 * Idempotent, so it is safe to run on every deploy and in tests.
 */
export async function ensureIndexes(): Promise<void> {
  const [r, res, o, e, ev] = await Promise.all([
    releases(),
    reservations(),
    orders(),
    entitlements(),
    storefrontEvents(),
  ]);

  await Promise.all([
    r.createIndex({ slug: 1 }, { unique: true }),
    res.createIndex({ purchase_id: 1 }, { unique: true }),
    // expireAfterSeconds: 0 ⇒ delete when `expires_at` passes.
    res.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    o.createIndex({ payment_reference: 1 }, { unique: true }),
    o.createIndex({ purchase_id: 1 }, { unique: true }),
    o.createIndex({ created_at: -1 }),
    e.createIndex({ token_hash: 1 }, { unique: true }),
    e.createIndex({ purchase_id: 1 }),
    ev.createIndex({ occurred_at: -1 }),
    ev.createIndex({ release_slug: 1, type: 1, occurred_at: -1 }),
  ]);
}
