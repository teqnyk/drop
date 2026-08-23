/**
 * Drop's documents (PRD §15). One collection per type.
 *
 * None of these declare `_id`. The MongoDB driver supplies it through
 * `WithId<T>` on reads and `OptionalId<T>` on writes; declaring it here as a
 * loose type fights those generics and makes every insert a cast.
 */

export type ReleaseStatus = "draft" | "live" | "paused" | "sold_out";

/**
 * A studio selling on Drop.
 *
 * Drop is the platform (PRD §1: "a storefront for creators", plural); a studio
 * is a tenant. Kept in the database rather than a constant for the same reason
 * releases are: a hardcoded studio list would keep rendering during the
 * database outage this shop exists to demonstrate.
 */
export type Studio = {
  slug: string;
  name: string;
  creator_name: string;
  tagline: string;
  bio: string;
  location: string;
  joined_at: string;
  /** Two colours the studio's card paints a gradient from. */
  palette: [string, string];
};

export type Release = {
  slug: string;
  /** The studio that sells it. Joins a release to its shopfront. */
  studio_slug: string;
  creator_name: string;
  studio_name: string;
  title: string;
  /** One line for the shop grid; the description is for the product page. */
  tagline: string;
  description: string;
  contents: string[];
  licence: string;
  price_amount: number; // minor units — 2900 is $29.00
  currency: string;
  quantity_total: number;
  quantity_remaining: number;
  closes_at: string | null;
  status: ReleaseStatus;
  product_asset_key: string;
  /** Two colours the product tile paints a gradient from. No image assets. */
  palette: [string, string];
  /** Which generated pattern the cover draws. See components/release-art. */
  art: "glyphs" | "baseline" | "letterform" | "waveform" | "contour" | "frames";
  published_at: string | null;
  created_at: string;
};

export type ReservationStatus = "held" | "converted" | "released";

export type Reservation = {
  purchase_id: string;
  release_slug: string;
  customer_email: string | null;
  status: ReservationStatus;
  /** TTL index: MongoDB expires the hold without a sweeper to run and get wrong. */
  expires_at: Date;
  created_at: string;
};

export type PaymentStatus = "pending" | "paid" | "failed";
export type FulfilmentStatus = "pending" | "delivered" | "failed";
export type EmailStatus = "pending" | "sent" | "failed" | "skipped";

export type Order = {
  /** The single id threaded through Drop, telemetry and the event stream. */
  purchase_id: string;
  release_slug: string;
  reservation_id: string | null;
  customer_email: string;
  /** Unique index — this is what makes webhook handling idempotent. */
  payment_reference: string;
  payment_status: PaymentStatus;
  fulfilment_status: FulfilmentStatus;
  email_status: EmailStatus;
  /**
   * The provider's own words when something failed. Bounded, and never
   * flattened to "an error occurred": the creator dashboard has to be able to
   * say WHY delivery failed, or it is just a red dot.
   */
  last_error: string | null;
  amount: number;
  currency: string;
  is_demo: boolean;
  created_at: string;
  completed_at: string | null;
};

export type Entitlement = {
  purchase_id: string;
  /** SHA-256 of the token. The raw token is emailed and never stored. */
  token_hash: string;
  expires_at: Date;
  download_count: number;
  last_downloaded_at: string | null;
  created_at: string;
};

export type StorefrontEventType =
  | "view"
  | "checkout_started"
  | "payment_failed"
  | "purchase_completed"
  | "download";

export type StorefrontEvent = {
  purchase_id: string | null;
  release_slug: string;
  type: StorefrontEventType;
  occurred_at: Date;
  referrer: string | null;
  device: { kind: string } | null;
  checkout: { latency_ms?: number; failure_reason?: string } | null;
  is_demo: boolean;
};

/**
 * Every demo scenario, in one place.
 *
 * The array is the source and the union is derived from it. Before this, the
 * union lived here and a runtime copy lived in BOTH lib/scenarios.ts and the
 * /demo route — so a fifth scenario could be listable but not enablable, or
 * enablable and invisible, depending on which copy was updated. Deriving makes
 * that divergence unrepresentable rather than merely discouraged.
 */
export const SCENARIO_TYPES = [
  "slow_checkout",
  "payment_failure",
  "email_failure",
  "frontend_exception",
  "telemetry_silence",
] as const;

export type ScenarioType = (typeof SCENARIO_TYPES)[number];

export type DemoScenario = {
  scenario_type: ScenarioType;
  configuration: Record<string, unknown>;
  enabled_at: string;
  /** Every scenario self-expires — the commonest live-demo failure is one left on. */
  expires_at: Date;
  disabled_at: string | null;
};
