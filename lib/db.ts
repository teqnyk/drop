import { MongoClient, type Db, type Collection } from "mongodb";
import { env } from "./env";
import type {
  DemoScenario,
  Entitlement,
  Order,
  Release,
  Reservation,
  Studio,
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

/**
 * One client per process, reused.
 *
 * **This does not survive Cloudflare Workers, and the reason is worth having
 * written down.** Deployed on 2026-08-23, Drop served every page that touches
 * the database intermittently: a fresh isolate answered in ~1.2s, and after
 * three to six requests that isolate poisoned permanently — every later query
 * failing in ~50ms with `MongoServerSelectionError: proxy request failed,
 * cannot connect to the specified address`. Runs of 500s interleaved with
 * 200s, which reads as flakiness rather than as a hard constraint.
 *
 * Workers cap simultaneous outbound connections at six per invocation, and the
 * driver's sockets from earlier invocations in the same isolate keep counting.
 * None of these helped, each tried and measured:
 *
 *   - seedlist URI instead of mongodb+srv  (needed anyway — Workers have no
 *     dns.resolveTxt — but not the cause);
 *   - serverSelectionTimeoutMS 5s → 20s    (made it worse: requests hung until
 *     the runtime cancelled them, which is a worse diagnostic than failing);
 *   - maxPoolSize 1, polled monitoring     (fewer sockets, same outcome);
 *   - evicting on topologyClosed           (the events do not fire for this);
 *   - ping-then-reconnect                  (the replacement connect() is
 *     refused just as instantly);
 *   - close-before-replace                 (no change);
 *   - directConnection to the primary,     (one socket, same outcome).
 *     one host, no topology monitoring
 *
 * The conclusion is that the driver's connection model and Workers' isolate
 * reuse are incompatible, not that some option is still untuned. Drop needs
 * either a Node runtime or a database reachable over HTTP. Kept simple here
 * rather than carrying machinery that does not work.
 */
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

export async function studios(): Promise<Collection<Studio>> {
  return (await db()).collection<Studio>("studios");
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
  const [st, r, res, o, e, ev] = await Promise.all([
    studios(),
    releases(),
    reservations(),
    orders(),
    entitlements(),
    storefrontEvents(),
  ]);

  await Promise.all([
    st.createIndex({ slug: 1 }, { unique: true }),
    r.createIndex({ slug: 1 }, { unique: true }),
    r.createIndex({ studio_slug: 1 }),
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
