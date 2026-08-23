import { describe, expect, it } from "vitest";
import { generateHistory } from "../lib/history";
import { CATALOGUE } from "../lib/fixture";

/**
 * The seeded history.
 *
 * PRD §24 asks for a *shape*, not a row count: "not uniform random traffic,
 * but a launch spike, a long tail, and a visible dent during any seeded
 * incident window." So that is what these assert. A test that only counted
 * documents would pass over uniform noise, which is the exact dataset the
 * requirement exists to rule out.
 */

const NOW = new Date("2026-08-23T12:00:00.000Z");
const history = generateHistory(NOW);

function completionsFor(slug: string) {
  return history.sales.filter((s) => s.releaseSlug === slug);
}

describe("what the shop claims vs what happened", () => {
  it("gives every release exactly the sales its product page advertises", () => {
    for (const entry of CATALOGUE) {
      // A storefront saying "38 sold" over a history containing 41 costs more
      // credibility than the whole dataset buys.
      expect(completionsFor(entry.slug)).toHaveLength(entry.sold);
    }
  });

  it("covers every release, including the paused and sold-out ones", () => {
    const slugs = new Set(history.sales.map((s) => s.releaseSlug));
    expect(slugs.size).toBe(CATALOGUE.length);
  });
});

describe("the launch spike and the long tail", () => {
  it("front-loads sales rather than spreading them evenly", () => {
    const entry = CATALOGUE[0];
    const sales = completionsFor(entry.slug).map((s) => s.at.getTime()).sort((a, b) => a - b);
    const launch = Math.min(...sales);
    const span = Math.max(...sales) - launch;

    const firstQuarter = sales.filter((t) => t - launch < span * 0.25).length;
    // Uniform traffic would put ~25% here. A launch puts far more, and this is
    // the single assertion that separates a believable dataset from noise.
    expect(firstQuarter / sales.length).toBeGreaterThan(0.45);
  });

  it("still sells in the final quarter — a tail, not a cliff", () => {
    const entry = CATALOGUE[0];
    const sales = completionsFor(entry.slug).map((s) => s.at.getTime()).sort((a, b) => a - b);
    const launch = Math.min(...sales);
    const span = Math.max(...sales) - launch;
    const lastQuarter = sales.filter((t) => t - launch > span * 0.75).length;
    expect(lastQuarter).toBeGreaterThan(0);
  });
});

describe("the incident", () => {
  const { startedAt, endedAt } = history.incident;
  const inWindow = (d: Date) => d >= startedAt && d <= endedAt;

  it("leaves a hole in completions", () => {
    const completed = history.sales.filter((s) => inWindow(s.at));
    // The dent. Nothing completes while it is happening.
    expect(completed).toHaveLength(0);
  });

  it("does NOT stop traffic — that is what makes it a dent and not a quiet night", () => {
    const attempts = history.events.filter(
      (e) => e.type === "checkout_started" && inWindow(e.at),
    );
    // An operator has to be able to tell "nobody came" from "everybody came
    // and nobody could pay". A drop in both looks like the former.
    expect(attempts.length).toBeGreaterThan(0);
  });

  it("records payment failures with a reason", () => {
    const failures = history.events.filter((e) => e.type === "payment_failed" && inWindow(e.at));
    expect(failures.length).toBeGreaterThan(0);
    for (const failure of failures) {
      expect(failure.checkout?.failure_reason).toBeTruthy();
    }
  });

  it("happens on exactly one release, at one time", () => {
    // PRD §24's "one clock". Four simultaneous incidents would read as the
    // platform failing rather than a dependency, and tell the wrong story.
    const slugs = new Set(
      history.events.filter((e) => e.type === "payment_failed").map((e) => e.releaseSlug),
    );
    expect([...slugs]).toEqual([CATALOGUE[0].slug]);
  });
});

describe("privacy — §16 applies to the event store too", () => {
  it("puts no customer email, payment reference or token in any event", () => {
    // Checked against the SHAPE of the forbidden values rather than against
    // every one of them: cross-checking 5,500 events against 271 emails and
    // 271 references is 400M string operations and times out. The prefixes are
    // the discriminator — every seeded reference starts "seed_pi_" and every
    // address contains "@", so one pass catches either leaking in.
    const forbidden = /@|seed_pi_|token/i;
    const leaked = history.events.filter((e) => forbidden.test(JSON.stringify(e)));
    expect(leaked).toEqual([]);
  });

  it("would fail if an email were put in an event", () => {
    // Proves the check above can actually catch something, rather than passing
    // because the regex never matches anything at all.
    const forbidden = /@|seed_pi_|token/i;
    expect(forbidden.test(JSON.stringify({ referrer: "ana0@example.com" }))).toBe(true);
    expect(forbidden.test(JSON.stringify({ purchaseId: "seed_pi_form-01_001" }))).toBe(true);
  });

  it("uses only reserved example.com addresses for the fictional buyers", () => {
    // RFC 2606 reserves it and it can never receive mail, so a seeded history
    // cannot become an accidental send.
    for (const sale of history.sales) {
      expect(sale.customerEmail.endsWith("@example.com")).toBe(true);
    }
  });

  it("keeps referrers to a host, never a full URL with a query string", () => {
    for (const event of history.events) {
      if (!event.referrer) continue;
      expect(event.referrer).not.toContain("/");
      expect(event.referrer).not.toContain("?");
    }
  });
});

describe("reproducibility", () => {
  it("produces an identical dataset for the same clock", () => {
    // PRD §24 requires screenshots "captured from the same seeded state".
    // Math.random would make that untrue between two runs a minute apart.
    const again = generateHistory(NOW);
    expect(JSON.stringify(again)).toBe(JSON.stringify(history));
  });

  it("does not give every release the same shape shifted in time", () => {
    const first = completionsFor(CATALOGUE[0].slug).map((s) => s.at.getHours());
    const second = completionsFor(CATALOGUE[1].slug).map((s) => s.at.getHours());
    // A single global PRNG would make these correlate visibly.
    expect(first.slice(0, 10)).not.toEqual(second.slice(0, 10));
  });
});
