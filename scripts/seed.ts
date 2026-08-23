/**
 * Restore Drop to the canonical demonstration state (PRD §20, §24).
 *
 *   pnpm seed
 *
 * Idempotent and destructive in the same breath: it wipes demo data and writes
 * the fixture back, then replays a believable operating history on top. A
 * presenter must be able to run this between takes without thinking about what
 * state the last run left behind.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import {
  ensureIndexes,
  releases,
  reservations,
  orders,
  entitlements,
  storefrontEvents,
  demoScenarios,
  studios,
} from "../lib/db";
import { canonicalCatalogue, canonicalStudios, CATALOGUE, FIXTURE, STUDIOS } from "../lib/fixture";
import { generateHistory } from "../lib/history";
import { recordEvent } from "../lib/events";
import { completePurchase } from "../lib/orders";

async function main() {
  await ensureIndexes();

  const [std, rel, res, ord, ent, ev, scn] = await Promise.all([
    studios(), releases(), reservations(), orders(), entitlements(), storefrontEvents(), demoScenarios(),
  ]);

  // Order matters only for legibility; none of these reference each other by id.
  await Promise.all([
    res.deleteMany({}),
    ord.deleteMany({}),
    ent.deleteMany({}),
    ev.deleteMany({}),
    scn.deleteMany({}),
  ]);

  for (const studio of canonicalStudios()) {
    await std.replaceOne({ slug: studio.slug }, studio, { upsert: true });
  }

  const catalogue = canonicalCatalogue();
  for (const release of catalogue) {
    await rel.replaceOne({ slug: release.slug }, release, { upsert: true });
  }

  const now = new Date();
  const history = generateHistory(now);

  // Written through the SAME writers live traffic uses (PRD §24). A dedicated
  // seeding path would be free to drift from the real one, and nobody would
  // notice until the seeded data disagreed with what the app actually records.
  for (const sale of history.sales) {
    await completePurchase({
      purchaseId: sale.purchaseId,
      releaseSlug: sale.releaseSlug,
      customerEmail: sale.customerEmail,
      paymentReference: sale.paymentReference,
      amount: catalogue.find((r) => r.slug === sale.releaseSlug)?.price_amount ?? 0,
      currency: FIXTURE.currency,
      isDemo: true,
      completedAt: sale.at,
    });
  }

  for (const event of history.events) {
    await recordEvent({
      type: event.type,
      releaseSlug: event.releaseSlug,
      purchaseId: event.purchaseId,
      referrer: event.referrer,
      device: event.device,
      checkout: event.checkout ?? null,
      isDemo: true,
      occurredAt: event.at,
    });
  }

  // recordEvent swallows its own failures on purpose — an analytics write must
  // never fail the checkout it measures. That makes it exactly the wrong thing
  // to trust here, so count what actually landed rather than assume.
  const [writtenEvents, writtenOrders] = await Promise.all([
    ev.countDocuments({}),
    ord.countDocuments({}),
  ]);

  // completePurchase emits one purchase_completed per order, so the total is
  // the generated events plus one per sale. Stating the arithmetic rather than
  // loosening the check: a tolerance here would have hidden the duplicate this
  // assertion caught.
  const expectedEvents = history.events.length + history.sales.length;
  const expectedOrders = history.sales.length;
  if (writtenEvents !== expectedEvents || writtenOrders !== expectedOrders) {
    throw new Error(
      `Seed wrote ${writtenEvents}/${expectedEvents} events and ` +
        `${writtenOrders}/${expectedOrders} orders. The database rejected some ` +
        `writes; the demo state is NOT canonical.`,
    );
  }

  // The claim the storefront makes must match the history behind it.
  for (const entry of CATALOGUE) {
    const sold = await ord.countDocuments({ release_slug: entry.slug });
    if (sold !== entry.sold) {
      throw new Error(
        `${entry.slug}: storefront says ${entry.sold} sold, history holds ${sold}.`,
      );
    }
  }

  // The earliest event, not the canonical release's launch — the catalogue
  // spans months and reporting only the newest release's window understates
  // what was actually written.
  const earliest = history.events.reduce(
    (min, e) => (e.at < min ? e.at : min),
    history.events[0]?.at ?? now,
  );
  const spread = `${earliest.toISOString().slice(0, 10)} → today`;
  console.log(
    `Seeded Drop: ${STUDIOS.length} studios, ${catalogue.length} releases, ` +
      `${writtenOrders} orders, ${writtenEvents} events (${spread}).\n` +
      `Incident window: ${history.incident.startedAt.toISOString()} ` +
      `(+${Math.round((history.incident.endedAt.getTime() - history.incident.startedAt.getTime()) / 60000)}m) ` +
      `on ${FIXTURE.slug}.`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
