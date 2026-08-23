/**
 * Environment access.
 *
 * Every value is required at the point of use and throws with the variable's
 * name when missing. There are no fallbacks on purpose: Drop demonstrates a
 * monitored stack, and a demo that silently runs on a default misrepresents
 * the thing it is demonstrating — the same rule Beaam's own codebase keeps
 * (a failure must never degrade to a plausible-looking success).
 */

/**
 * The studio a bare allowlist entry maps to.
 *
 * Inlined rather than imported from lib/fixture to keep lib/env free of
 * application data — env is loaded by scripts and tests that have no business
 * pulling in the catalogue.
 */
const CANONICAL_STUDIO_SLUG = "soft-theory";

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill it in — ` +
        `Drop has no fallback for this value on purpose.`,
    );
  }
  return value.trim();
}

export const env = {
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3020",

  mongoUri: () => required("MONGODB_URI"),
  mongoDb: () => process.env.MONGODB_DB?.trim() || "drop",

  /**
   * Stripe, test mode only.
   *
   * Refusing a live key is not paranoia: Drop is a public demonstration app
   * whose whole job is to be broken on purpose, and a live key would let a
   * scenario take real money from a real person. This is the one check worth
   * making impossible to skip.
   */
  stripeSecret: () => {
    const key = required("STRIPE_SECRET_KEY");
    if (!key.startsWith("sk_test_")) {
      throw new Error(
        "STRIPE_SECRET_KEY is not a test-mode key. Drop must never be pointed " +
          "at live mode — it exists to fail on purpose, and a live key would " +
          "make those failures real.",
      );
    }
    return key;
  },
  stripeWebhookSecret: () => required("STRIPE_WEBHOOK_SECRET"),

  resendApiKey: () => required("RESEND_API_KEY"),
  resendFrom: () => required("RESEND_FROM"),

  /** Guards /demo. Unset ⇒ the control centre refuses, rather than opening. */
  demoSecret: () => process.env.DROP_DEMO_SECRET?.trim() ?? "",

  /** Guards the fulfilment sweep. Unset ⇒ it refuses. See the route's note. */
  cronSecret: () => process.env.DROP_CRON_SECRET?.trim() ?? "",

  /** Sentry. Unset ⇒ the SDK is inert and /demo says so out loud. */
  sentryDsn: () => process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ?? "",

  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),

  /**
   * Who is allowed into the dashboard, by email address.
   *
   * A Supabase project accepts signups by default, so "has a session" is not
   * the same as "is the creator" — without this list, anyone who signs up
   * reaches the release controls. Empty means nobody, which is why an
   * unconfigured deployment refuses instead of opening.
   */
  creators: (): { email: string; studioSlug: string }[] =>
    (process.env.DROP_CREATOR_EMAILS ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        // "email" or "email:studio-slug". A bare address gets the canonical
        // studio, so the existing single-creator configuration keeps working.
        const separator = entry.lastIndexOf(":");
        const email = (separator === -1 ? entry : entry.slice(0, separator))
          .trim()
          .toLowerCase();
        const studioSlug = (separator === -1 ? "" : entry.slice(separator + 1))
          .trim()
          .toLowerCase();
        return { email, studioSlug: studioSlug || CANONICAL_STUDIO_SLUG };
      })
      .filter((c) => c.email.length > 0),

  /** Just the addresses, for the allowlist check. */
  creatorEmails: (): string[] => env.creators().map((c) => c.email),
};

/** Which optional subsystems are configured, for honest degradation. */
export const configured = {
  stripe: () => Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
  resend: () => Boolean(process.env.RESEND_API_KEY?.trim()),
  mongo: () => Boolean(process.env.MONGODB_URI?.trim()),
  demo: () => Boolean(process.env.DROP_DEMO_SECRET?.trim()),
  sentry: () => Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()),
  auth: () =>
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) &&
    Boolean(process.env.DROP_CREATOR_EMAILS?.trim()),
};
