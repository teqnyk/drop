/**
 * Restore Drop to the canonical demonstration state (PRD §20).
 *
 *   pnpm seed
 *
 * Idempotent and destructive in the same breath: it wipes demo data and writes
 * the fixture back. A presenter must be able to run this between takes without
 * thinking about what state the last run left behind.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { ensureIndexes, releases, reservations, orders, entitlements, storefrontEvents, demoScenarios } from "../lib/db";
import { canonicalRelease, FIXTURE } from "../lib/fixture";

async function main() {
  await ensureIndexes();

  const [rel, res, ord, ent, ev, scn] = await Promise.all([
    releases(), reservations(), orders(), entitlements(), storefrontEvents(), demoScenarios(),
  ]);

  // Order matters only for legibility; none of these reference each other by id.
  await Promise.all([
    res.deleteMany({}),
    ord.deleteMany({}),
    ent.deleteMany({}),
    ev.deleteMany({}),
    scn.deleteMany({}),
  ]);

  await rel.replaceOne({ slug: FIXTURE.slug }, canonicalRelease(), { upsert: true });

  const release = await rel.findOne({ slug: FIXTURE.slug });
  console.log(
    `Seeded ${FIXTURE.studioName} — ${release?.title}: ` +
      `${(release?.quantity_total ?? 0) - (release?.quantity_remaining ?? 0)} of ` +
      `${release?.quantity_total} sold, status ${release?.status}.`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
