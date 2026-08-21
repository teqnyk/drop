/**
 * Environment access.
 *
 * Every value is required at the point of use and throws with the variable's
 * name when missing. There are no fallbacks on purpose: Drop demonstrates a
 * monitored stack, and a demo that silently runs on a default misrepresents
 * the thing it is demonstrating — the same rule Beaam's own codebase keeps
 * (a failure must never degrade to a plausible-looking success).
 */

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
};

/** Which optional subsystems are configured, for honest degradation. */
export const configured = {
  stripe: () => Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
  resend: () => Boolean(process.env.RESEND_API_KEY?.trim()),
  mongo: () => Boolean(process.env.MONGODB_URI?.trim()),
  demo: () => Boolean(process.env.DROP_DEMO_SECRET?.trim()),
};
