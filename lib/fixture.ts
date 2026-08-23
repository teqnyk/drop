import type { Release, Studio } from "./types";

/**
 * The canonical demonstration catalogue (PRD §18).
 *
 * ONE definition, used by the seed script, the tests and any documentation
 * that quotes a number. Beaam's marketing site spent August discovering what
 * happens when the same fact is typed into eight places: "38 of 100 sold" on
 * one page and 41 on another undoes in a glance what a shared fixture is for.
 *
 * Drop is the platform and a studio is a tenant (PRD §1: "a storefront for
 * creators", plural). Soft Theory is "the canonical Drop storefront" from §6,
 * not the whole application — a homepage that showed only Soft Theory would
 * make Drop and Soft Theory the same thing, which is not the product.
 *
 * Several products rather than one, because a shop with a single item does not
 * exercise the states a shop has — sold out, paused, nearly gone — and a demo
 * that never shows them cannot claim to have handled them. Form/01 stays the
 * canonical release every script and test refers to.
 */
export const FIXTURE = {
  creatorName: "Maya Chen",
  studioName: "Soft Theory",
  /** The canonical studio (PRD §6). */
  studioSlug: "soft-theory",
  /** The release every demo script, test and screenshot refers to. */
  slug: "form-01",
  title: "Form/01",
  /** Sold at the start of a demo. The storefront reads it; nothing hardcodes it. */
  soldAtRest: 38,
  editionSize: 100,
  priceAmount: 2900,
  currency: "usd",
} as const;

type StudioEntry = {
  slug: string;
  name: string;
  creatorName: string;
  tagline: string;
  bio: string;
  location: string;
  joinedDaysAgo: number;
  palette: [string, string];
};

/**
 * The studios selling on Drop.
 *
 * Three, deliberately: one is the canonical fixture every script names, and
 * the other two exist so the homepage reads as a marketplace rather than as
 * one shop with a platform's name on it.
 */
export const STUDIOS: readonly StudioEntry[] = [
  {
    slug: FIXTURE.studioSlug,
    name: FIXTURE.studioName,
    creatorName: FIXTURE.creatorName,
    tagline: "Interface tools, made slowly",
    bio:
      "A one-person studio making tools for people who build software. Icons, " +
      "grids, type and reference — each released as a fixed edition and never " +
      "quietly restocked.",
    location: "Lisbon",
    joinedDaysAgo: 420,
    palette: ["#ff5a36", "#ffb199"],
  },
  {
    slug: "north-shed",
    name: "North Shed",
    creatorName: "Ewan Reid",
    tagline: "Field recordings and things made from them",
    bio:
      "Sound for people who are tired of the same twelve stock loops. Recorded " +
      "outdoors, mostly in bad weather, and edited less than you would expect.",
    location: "Orkney",
    joinedDaysAgo: 260,
    palette: ["#2f5d7c", "#9ec9e2"],
  },
  {
    slug: "atlas-and-co",
    name: "Atlas & Co.",
    creatorName: "Priya Nandakumar",
    tagline: "Maps, charts and the data behind them",
    bio:
      "Cartography for products that need a map and do not need a whole GIS " +
      "team. Projections chosen on purpose, sources cited, licences readable.",
    location: "Bengaluru",
    joinedDaysAgo: 95,
    palette: ["#3f6b44", "#a8d5a2"],
  },
];

type CatalogueEntry = {
  slug: string;
  studioSlug: string;
  title: string;
  /** Short line for the shop grid. The long one lives on the product page. */
  tagline: string;
  description: string;
  contents: string[];
  licence: string;
  priceAmount: number;
  editionSize: number;
  sold: number;
  status: Release["status"];
  /** Days before "now" that this went on sale. Orders the shop grid. */
  launchedDaysAgo: number;
  /** Two colours; the product tile paints a gradient from them. */
  palette: [string, string];
  /** Which generated pattern the cover draws — chosen to suit the product. */
  art: Release["art"];
};

/**
 * Deliberately varied: one nearly gone, one sold out, one paused, one fresh.
 * Every state the storefront can render appears in the seeded shop, so none of
 * them is first exercised in front of an audience.
 */
export const CATALOGUE: readonly CatalogueEntry[] = [
  {
    slug: FIXTURE.slug,
    studioSlug: FIXTURE.studioSlug,
    title: FIXTURE.title,
    tagline: "240 interface icons, drawn for real screens",
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
    priceAmount: FIXTURE.priceAmount,
    editionSize: FIXTURE.editionSize,
    sold: FIXTURE.soldAtRest,
    status: "live",
    launchedDaysAgo: 14,
    palette: ["#ff5a36", "#ffb199"],
    art: "glyphs",
  },
  {
    slug: "grid-02",
    studioSlug: FIXTURE.studioSlug,
    title: "Grid/02",
    tagline: "A baseline grid that survives contact with real content",
    description:
      "A layout system for product teams who keep rebuilding the same spacing " +
      "scale. Eight sizes, three breakpoints, and the arithmetic already done.",
    contents: [
      "Figma library with auto-layout primitives",
      "CSS custom properties and a Tailwind preset",
      "A twelve-page rationale, for the argument you will have",
    ],
    licence: "Personal and commercial use. No resale as a competing system.",
    priceAmount: 3900,
    editionSize: 150,
    sold: 141,
    status: "live",
    launchedDaysAgo: 42,
    palette: ["#2f6f6b", "#8fd4c8"],
    art: "baseline",
  },
  {
    slug: "mono-03",
    studioSlug: FIXTURE.studioSlug,
    title: "Mono/03",
    tagline: "A monospace face for long sittings",
    description:
      "Drawn for terminals and diff views at 13px, where most monospace faces " +
      "were drawn for specimens at 72. Sold out; a second edition is not planned.",
    contents: [
      "Regular, Italic, Bold, Bold Italic",
      "Variable font plus static instances",
      "Full Latin Extended, 340 ligature pairs",
    ],
    licence: "Personal and commercial use, unlimited seats. No redistribution.",
    priceAmount: 6400,
    editionSize: 80,
    sold: 80,
    status: "sold_out",
    launchedDaysAgo: 96,
    palette: ["#3b3a63", "#a5a2d6"],
    art: "letterform",
  },
  {
    slug: "still-04",
    studioSlug: FIXTURE.studioSlug,
    title: "Still/04",
    tagline: "Forty photographs of nothing happening",
    description:
      "Quiet reference photography for mockups that need a wall, a window or a " +
      "table and not a stock-photo handshake. Paused while the next batch is scanned.",
    contents: [
      "40 photographs, 6000px, colour-managed",
      "Web-optimised set at three widths",
      "Location and film notes",
    ],
    licence: "Use in your own work, commercial or not. No resale as stock.",
    priceAmount: 2400,
    editionSize: 200,
    sold: 12,
    status: "paused",
    launchedDaysAgo: 5,
    palette: ["#7a5c33", "#e0c9a6"],
    art: "frames",
  },
  {
    slug: "coast-01",
    studioSlug: "north-shed",
    title: "Coast/01",
    tagline: "Ninety minutes of the Atlantic being unhelpful",
    description:
      "Field recordings from Orkney across four seasons — surf, shingle, wind " +
      "through fences, a harbour at 4am. Recorded in stereo and left long, so " +
      "you can find your own loop rather than use someone else's.",
    contents: [
      "38 recordings, 24-bit / 96kHz WAV",
      "Mixed-down MP3 set for scratch work",
      "Location, date and equipment notes",
    ],
    licence: "Use in your own work, commercial or not. No resale as a sample pack.",
    priceAmount: 4200,
    editionSize: 120,
    sold: 47,
    status: "live",
    launchedDaysAgo: 23,
    palette: ["#2f5d7c", "#9ec9e2"],
    art: "waveform",
  },
  {
    slug: "hush-02",
    studioSlug: "north-shed",
    title: "Hush/02",
    tagline: "Room tone for rooms you do not have",
    description:
      "Twelve interiors recorded empty: a village hall, a ferry waiting room, " +
      "a chapel, a launderette. For anyone cutting dialogue who needs the " +
      "silence between lines to sound like somewhere.",
    contents: ["12 interiors, 10 minutes each", "24-bit WAV", "Notes on each space"],
    licence: "Use in your own work, commercial or not. No resale as a sample pack.",
    priceAmount: 2800,
    editionSize: 60,
    sold: 60,
    status: "sold_out",
    launchedDaysAgo: 140,
    palette: ["#4a4a52", "#b9b7c4"],
    art: "waveform",
  },
  {
    slug: "relief-01",
    studioSlug: "atlas-and-co",
    title: "Relief/01",
    tagline: "Shaded relief basemaps that do not look like 2009",
    description:
      "A basemap set for products that need a map and not a GIS department. " +
      "Six projections, three palettes, and the source data cited so you can " +
      "answer where it came from when someone asks.",
    contents: [
      "Vector tiles and static SVG at three zooms",
      "Six projections, three palettes",
      "Source and licence manifest",
    ],
    licence: "Commercial use in your own products. No resale as map data.",
    priceAmount: 8900,
    editionSize: 60,
    sold: 9,
    status: "live",
    launchedDaysAgo: 9,
    palette: ["#3f6b44", "#a8d5a2"],
    art: "contour",
  },
];

/** Every studio, ready to write. */
export function canonicalStudios(now = new Date()): Studio[] {
  return STUDIOS.map((entry) => ({
    slug: entry.slug,
    name: entry.name,
    creator_name: entry.creatorName,
    tagline: entry.tagline,
    bio: entry.bio,
    location: entry.location,
    joined_at: new Date(now.getTime() - entry.joinedDaysAgo * 86_400_000).toISOString(),
    palette: [...entry.palette] as [string, string],
  }));
}

/** Every release, at its at-rest state, ready to write. */
export function canonicalCatalogue(now = new Date()): Release[] {
  return CATALOGUE.map((entry) => {
    const launchedAt = new Date(now.getTime() - entry.launchedDaysAgo * 86_400_000);
    const studio = STUDIOS.find((s) => s.slug === entry.studioSlug);
    if (!studio) throw new Error(`${entry.slug} names an unknown studio: ${entry.studioSlug}`);
    return {
      slug: entry.slug,
      studio_slug: studio.slug,
      creator_name: studio.creatorName,
      studio_name: studio.name,
      title: entry.title,
      tagline: entry.tagline,
      description: entry.description,
      contents: [...entry.contents],
      licence: entry.licence,
      price_amount: entry.priceAmount,
      currency: FIXTURE.currency,
      quantity_total: entry.editionSize,
      quantity_remaining: entry.editionSize - entry.sold,
      closes_at: null,
      status: entry.status,
      product_asset_key: `${entry.slug}.zip`,
      palette: [...entry.palette] as [string, string],
      art: entry.art,
      published_at: launchedAt.toISOString(),
      created_at: launchedAt.toISOString(),
    };
  });
}

/** The one release every demo script names. */
export function canonicalRelease(now = new Date()): Release {
  const release = canonicalCatalogue(now).find((r) => r.slug === FIXTURE.slug);
  if (!release) throw new Error("FIXTURE.slug is missing from CATALOGUE");
  return release;
}
