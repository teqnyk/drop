import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ensureIndexes, releases, reservations, db } from "@/lib/db";
import { convertReservation, releaseUnit, reserveUnit } from "@/lib/inventory";
import type { Release } from "@/lib/types";

/**
 * The inventory invariants, against a real MongoDB.
 *
 * PRD §12 requires that inventory can never go negative and that concurrent
 * buyers of the last copy cannot both win. Those are the claims a demo about
 * reliability cannot afford to get wrong, and they are exactly the claims a
 * mocked database would happily confirm while the real one failed — so this
 * suite runs against an actual server (MONGODB_URI, or a local mongod).
 */
const SLUG = "form-01";

function seed(quantity: number): Release {
  return {
    slug: SLUG,
    studio_slug: "soft-theory",
    creator_name: "Maya Chen",
    studio_name: "Soft Theory",
    title: "Form/01",
    tagline: "Interface icons.",
    description: "Interface icons.",
    contents: ["SVG", "Figma library"],
    licence: "Personal and commercial use",
    price_amount: 2900,
    currency: "usd",
    quantity_total: quantity,
    quantity_remaining: quantity,
    closes_at: null,
    status: "live",
    product_asset_key: "form-01.zip",
    palette: ["#ff5a36", "#ffb199"],
    art: "glyphs",
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
}

beforeEach(async () => {
  const database = await db();
  await database.dropDatabase();
  await ensureIndexes();
});

afterAll(async () => {
  const database = await db();
  await database.dropDatabase();
});

describe("reserving a unit", () => {
  it("decrements exactly one and hands back a purchase id", async () => {
    await (await releases()).insertOne(seed(100));

    const result = await reserveUnit(SLUG);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.purchaseId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.release.quantity_remaining).toBe(99);
  });

  it("NEVER goes negative when everyone wants the last copy", async () => {
    // The invariant the whole design turns on. Ten concurrent buyers, one unit:
    // exactly one may win, and the count must land on zero rather than -9.
    await (await releases()).insertOne(seed(1));

    const results = await Promise.all(Array.from({ length: 10 }, () => reserveUnit(SLUG)));

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(9);

    const release = await (await releases()).findOne({ slug: SLUG });
    expect(release?.quantity_remaining).toBe(0);
    expect(release?.status).toBe("sold_out");
  });

  it("refuses once sold out, and says so", async () => {
    await (await releases()).insertOne(seed(1));
    await reserveUnit(SLUG);

    const result = await reserveUnit(SLUG);

    expect(result).toEqual({ ok: false, reason: "sold_out" });
  });

  it("refuses a paused release without touching stock", async () => {
    await (await releases()).insertOne({ ...seed(5), status: "paused" });

    const result = await reserveUnit(SLUG);

    expect(result).toEqual({ ok: false, reason: "not_live" });
    const release = await (await releases()).findOne({ slug: SLUG });
    expect(release?.quantity_remaining).toBe(5);
  });

  it("refuses a closed release", async () => {
    await (await releases()).insertOne({
      ...seed(5),
      closes_at: new Date(Date.now() - 60_000).toISOString(),
    });

    expect(await reserveUnit(SLUG)).toEqual({ ok: false, reason: "closed" });
  });
});

describe("releasing a hold", () => {
  it("returns the unit and reopens a sold-out release", async () => {
    await (await releases()).insertOne(seed(1));
    const held = await reserveUnit(SLUG);
    if (!held.ok) throw new Error("expected a reservation");

    expect(await releaseUnit(held.purchaseId)).toBe(true);

    const release = await (await releases()).findOne({ slug: SLUG });
    expect(release?.quantity_remaining).toBe(1);
    expect(release?.status).toBe("live");
  });

  it("cannot return the same unit twice", async () => {
    // An expiry racing an explicit cancel must not inflate the edition beyond
    // quantity_total — the mirror image of going negative, and just as wrong.
    await (await releases()).insertOne(seed(1));
    const held = await reserveUnit(SLUG);
    if (!held.ok) throw new Error("expected a reservation");

    const [first, second] = await Promise.all([
      releaseUnit(held.purchaseId),
      releaseUnit(held.purchaseId),
    ]);

    expect([first, second].filter(Boolean)).toHaveLength(1);
    const release = await (await releases()).findOne({ slug: SLUG });
    expect(release?.quantity_remaining).toBe(1);
  });
});

describe("converting a hold", () => {
  it("converts once and is idempotent", async () => {
    await (await releases()).insertOne(seed(10));
    const held = await reserveUnit(SLUG);
    if (!held.ok) throw new Error("expected a reservation");

    expect(await convertReservation(held.purchaseId)).toBe(true);
    // A replayed webhook converts again; it must be a no-op, not a second sale.
    expect(await convertReservation(held.purchaseId)).toBe(false);

    const reservation = await (await reservations()).findOne({
      purchase_id: held.purchaseId,
    });
    expect(reservation?.status).toBe("converted");
  });

  it("does not return stock — a converted hold is a sale", async () => {
    await (await releases()).insertOne(seed(10));
    const held = await reserveUnit(SLUG);
    if (!held.ok) throw new Error("expected a reservation");
    await convertReservation(held.purchaseId);

    expect(await releaseUnit(held.purchaseId)).toBe(false);
    const release = await (await releases()).findOne({ slug: SLUG });
    expect(release?.quantity_remaining).toBe(9);
  });
});
