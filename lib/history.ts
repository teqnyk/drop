import { CATALOGUE } from "./fixture";
import type { StorefrontEventType } from "./types";

/**
 * A believable operating history for the canonical release (PRD §24).
 *
 * Pure: it takes a clock and returns documents. Nothing here touches the
 * database, so the *shape* — the launch spike, the decay, the dent — is
 * testable without one, and the seed script's only job is to write what this
 * returns through the normal writers.
 *
 * The requirement is specific and worth quoting: "not uniform random traffic,
 * but a launch spike, a long tail, and a visible dent during any seeded
 * incident window." Uniform noise is what makes a demo dataset read as fake
 * from across the room — real launches are front-loaded and real incidents
 * leave a hole you can point at.
 *
 * Generated per release, so the shop has four overlapping histories of
 * different ages rather than one. Each release's sale count is exactly the
 * number its product page claims, because a storefront saying "38 sold" over a
 * history containing 41 costs more credibility than the whole dataset buys.
 */

/** Traffic decays from the launch. ~3 days to fall to a third. */
const DECAY_HOURS = 72;
/** Days after ITS launch that the canonical release's incident sits. */
const INCIDENT_AT_DAY = 8;
const INCIDENT_MINUTES = 40;
/** Views per completed sale. A limited edition converts well; this is not SaaS. */
const VIEWS_PER_SALE = 17;
/** Of the people who start checkout outside the incident, how many finish. */
const CHECKOUT_COMPLETION = 0.72;
/** Of completed purchases, how many actually download. */
const DOWNLOAD_RATE = 0.86;

const HOUR = 3_600_000;
const MINUTE = 60_000;

export type HistoryEvent = {
  type: StorefrontEventType;
  releaseSlug: string;
  at: Date;
  purchaseId: string | null;
  referrer: string | null;
  device: string;
  checkout?: { latency_ms?: number; failure_reason?: string };
};

export type HistorySale = {
  purchaseId: string;
  releaseSlug: string;
  at: Date;
  customerEmail: string;
  paymentReference: string;
};

export type SeededHistory = {
  events: HistoryEvent[];
  sales: HistorySale[];
  launchedAt: Date;
  incident: { startedAt: Date; endedAt: Date };
};

/**
 * Deterministic PRNG (mulberry32).
 *
 * Math.random would make every re-seed a different dataset, so two screenshots
 * taken a day apart would disagree about a history that is supposed to be
 * canonical. PRD §24 requires screenshots "captured from the same seeded
 * state"; that is only true if the state is reproducible.
 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d_2b_79_f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** People buy in the evening. A flat clock is the other tell of fake data. */
function diurnal(hourOfDay: number): number {
  // Peaks around 20:00, troughs around 05:00, never quite zero.
  return 0.25 + 0.75 * (0.5 + 0.5 * Math.cos(((hourOfDay - 20) / 24) * 2 * Math.PI));
}

const REFERRERS: (string | null)[] = [
  null, // direct — the largest single bucket for a following-driven launch
  null,
  "www.instagram.com",
  "www.instagram.com",
  "t.co",
  "news.ycombinator.com",
  "www.google.com",
  "dribbble.com",
];

/**
 * Fictional buyers. example.com is reserved by RFC 2606 and can never receive
 * mail, so a seeded history cannot become an accidental send.
 */
const NAMES = [
  "ana", "ben", "cara", "dev", "elin", "fay", "gus", "hana", "ivo", "jo",
  "kit", "lena", "mo", "nils", "ola", "pia", "quinn", "rui", "sam", "tove",
];

/**
 * Hourly weights across the window, and the hour the incident falls in.
 *
 * Two curves, deliberately: traffic keeps its shape through the incident while
 * completions go to zero. That difference IS the dent — a drop in both would
 * just look like a quiet night, which is the thing an operator must be able to
 * tell it apart from.
 */
function hourlyWeights(launchedAt: Date, windowDays: number, withIncident: boolean) {
  const hours = windowDays * 24;
  const incidentHour = withIncident ? INCIDENT_AT_DAY * 24 + 14 : -1; // early afternoon
  const traffic: number[] = [];
  const conversion: number[] = [];

  for (let h = 0; h < hours; h++) {
    const hourOfDay = new Date(launchedAt.getTime() + h * HOUR).getHours();
    const weight = Math.exp(-h / DECAY_HOURS) * diurnal(hourOfDay);
    traffic.push(weight);
    conversion.push(h === incidentHour ? 0 : weight);
  }
  return { traffic, conversion, incidentHour };
}

/**
 * Place `count` moments across weighted hours by quantile.
 *
 * Deterministic and exact: sampling would give 38±noise sales against a
 * fixture that says exactly 38, and a storefront claiming "38 sold" over a
 * history containing 41 is the kind of small contradiction that costs more
 * credibility than the whole dataset buys.
 */
function placeByWeight(weights: number[], count: number, base: Date, jitter: () => number): Date[] {
  const total = weights.reduce((a, b) => a + b, 0);
  const out: Date[] = [];
  let cursor = 0;
  let carried = 0;

  for (let i = 0; i < count; i++) {
    const target = ((i + 0.5) / count) * total;
    while (cursor < weights.length - 1 && carried + weights[cursor] < target) {
      carried += weights[cursor];
      cursor++;
    }
    out.push(new Date(base.getTime() + cursor * HOUR + Math.floor(jitter() * HOUR)));
  }
  return out;
}

/**
 * One release's history.
 *
 * `seed` varies per release so four histories are not four copies of the same
 * shape shifted in time — the PRNG is fixed per release, not global.
 */
function generateForRelease(
  now: Date,
  release: { slug: string; sold: number; launchedDaysAgo: number },
  seed: number,
  withIncident: boolean,
): SeededHistory {
  const random = rng(seed);
  const windowDays = release.launchedDaysAgo;
  const launchedAt = new Date(now.getTime() - windowDays * 24 * HOUR);
  const { traffic, conversion, incidentHour } = hourlyWeights(launchedAt, windowDays, withIncident);

  const incidentStart = new Date(
    launchedAt.getTime() + (incidentHour >= 0 ? incidentHour : 0) * HOUR,
  );
  const incidentEnd = new Date(incidentStart.getTime() + INCIDENT_MINUTES * MINUTE);

  const saleCount = release.sold;
  const saleTimes = placeByWeight(conversion, saleCount, launchedAt, random);
  const viewTimes = placeByWeight(traffic, saleCount * VIEWS_PER_SALE, launchedAt, random);

  // Built without the slug, which is stamped on once at the end — there are
  // six push sites and repeating it at each is six chances to get one wrong.
  const events: Omit<HistoryEvent, "releaseSlug">[] = [];
  const sales: Omit<HistorySale, "releaseSlug">[] = [];

  // Views: everyone who looked, including the ones who never started.
  for (const at of viewTimes) {
    events.push({
      type: "view",
      at,
      purchaseId: null,
      referrer: REFERRERS[Math.floor(random() * REFERRERS.length)],
      device: random() < 0.55 ? "mobile" : "desktop",
    });
  }

  // Sales, each with the funnel that produced it.
  saleTimes.forEach((at, index) => {
    const purchaseId = `seed_${release.slug}_${String(index + 1).padStart(3, "0")}`;
    const device = random() < 0.55 ? "mobile" : "desktop";
    const referrer = REFERRERS[Math.floor(random() * REFERRERS.length)];
    const startedAt = new Date(at.getTime() - Math.floor(40_000 + random() * 90_000));

    events.push({
      type: "checkout_started",
      at: startedAt,
      purchaseId,
      referrer,
      device,
    });
    // No purchase_completed here. completePurchase emits it, because that is
    // where an order actually comes into existence — and the seed replays
    // through completePurchase. Emitting it here too produced exactly one
    // duplicate per sale, which the seed's own verification caught. It would
    // also have carried a referrer and a device that the real webhook path
    // never has, quietly making the seeded data richer than reality.

    if (random() < DOWNLOAD_RATE) {
      // Most people download straight away; a few come back the next evening.
      const delay = random() < 0.8 ? random() * 4 * MINUTE : random() * 30 * HOUR;
      events.push({
        type: "download",
        at: new Date(at.getTime() + delay),
        purchaseId,
        referrer: null,
        device,
      });
    }

    sales.push({
      purchaseId,
      at,
      customerEmail: `${NAMES[index % NAMES.length]}${index}@example.com`,
      paymentReference: `seed_pi_${release.slug}_${String(index + 1).padStart(3, "0")}`,
    });
  });

  // Abandoned checkouts outside the incident — a funnel with no leak reads as
  // invented. These carry no purchase, because nothing was ever created.
  const abandonCount = Math.round((saleCount / CHECKOUT_COMPLETION) - saleCount);
  for (const at of placeByWeight(conversion, abandonCount, launchedAt, random)) {
    events.push({
      type: "checkout_started",
      at,
      purchaseId: null,
      referrer: REFERRERS[Math.floor(random() * REFERRERS.length)],
      device: random() < 0.55 ? "mobile" : "desktop",
    });
  }

  // The incident: people kept arriving and kept trying. Nothing completed.
  const attempts = withIncident ? 9 : 0;
  for (let i = 0; i < attempts; i++) {
    const at = new Date(incidentStart.getTime() + Math.floor(random() * INCIDENT_MINUTES * MINUTE));
    const purchaseId = `seed_fail_${release.slug}_${String(i + 1).padStart(2, "0")}`;
    const device = random() < 0.55 ? "mobile" : "desktop";
    events.push({ type: "checkout_started", at, purchaseId, referrer: null, device });
    events.push({
      type: "payment_failed",
      at: new Date(at.getTime() + Math.floor(2000 + random() * 6000)),
      purchaseId,
      referrer: null,
      device,
      checkout: { failure_reason: "card_declined" },
    });
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  return {
    events: events.map((e) => ({ ...e, releaseSlug: release.slug })),
    sales: sales.map((sale) => ({ ...sale, releaseSlug: release.slug })),
    launchedAt,
    incident: { startedAt: incidentStart, endedAt: incidentEnd },
  };
}

/**
 * The whole shop's history.
 *
 * The incident belongs to the canonical release only. One dent, in one place,
 * at one time — PRD §24's "one clock". Four simultaneous incidents would make
 * the story unreadable and imply the platform, not a dependency, was at fault.
 */
export function generateHistory(now: Date): SeededHistory {
  const parts = CATALOGUE.map((entry, index) =>
    generateForRelease(
      now,
      { slug: entry.slug, sold: entry.sold, launchedDaysAgo: entry.launchedDaysAgo },
      0x50_52_4f_50 + index * 0x9e_37_79_b9,
      index === 0,
    ),
  );

  const canonical = parts[0];
  return {
    events: parts.flatMap((p) => p.events).sort((a, b) => a.at.getTime() - b.at.getTime()),
    sales: parts.flatMap((p) => p.sales).sort((a, b) => a.at.getTime() - b.at.getTime()),
    launchedAt: canonical.launchedAt,
    incident: canonical.incident,
  };
}
