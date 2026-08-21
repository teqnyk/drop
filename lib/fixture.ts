import type { Release } from "./types";

/**
 * The canonical demonstration fixture (PRD §18).
 *
 * ONE definition, used by the seed script, the tests and any documentation
 * that quotes a number. Beaam's marketing site spent August discovering what
 * happens when the same fact is typed into eight places: "38 of 100 sold" on
 * one page and 41 on another undoes in a glance what a shared fixture is for.
 */
export const FIXTURE = {
  creatorName: "Maya Chen",
  studioName: "Soft Theory",
  slug: "form-01",
  title: "Form/01",
  /** Sold at the start of a demo. The storefront reads it; nothing hardcodes it. */
  soldAtRest: 38,
  editionSize: 100,
  priceAmount: 2900,
  currency: "usd",
} as const;

export function canonicalRelease(now = new Date()): Release {
  return {
    slug: FIXTURE.slug,
    creator_name: FIXTURE.creatorName,
    studio_name: FIXTURE.studioName,
    title: FIXTURE.title,
    description:
      "Carefully drawn interface icons for independent software products. " +
      "Every icon exists because a real screen needed it — no filler, no " +
      "twelve variations of a cog.",
    contents: [
      "240 icons, SVG",
      "Figma library with components and variants",
      "24px and 16px optical sizes",
    ],
    licence: "Personal and commercial use. No resale of the icons themselves.",
    price_amount: FIXTURE.priceAmount,
    currency: FIXTURE.currency,
    quantity_total: FIXTURE.editionSize,
    quantity_remaining: FIXTURE.editionSize - FIXTURE.soldAtRest,
    closes_at: null,
    status: "live",
    product_asset_key: "form-01.zip",
    published_at: now.toISOString(),
    created_at: now.toISOString(),
  };
}
