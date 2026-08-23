/**
 * One Sentry configuration, shared by every runtime (PRD §22 — error tracking).
 *
 * Drop already sends OpenTelemetry to Beaam, so the division of labour is
 * deliberate and worth stating: **Beaam owns telemetry, Sentry owns
 * exceptions.** Tracing is off here rather than merely sampled low — two
 * tracing systems on one request produce two partial pictures and an argument
 * about which is right, which is the opposite of what a demonstration stack
 * should teach.
 *
 * No Session Replay and no user feedback widget. Replay records the DOM, and
 * the dashboard renders buyers' email addresses — shipping that on a public
 * demo would trade a privacy problem for a feature nothing here needs.
 */
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined,

  // Errors only. See the note above.
  tracesSampleRate: 0,

  // Everything in Drop is a demonstration, and Sentry should say so rather
  // than leaving someone to guess whether an issue came from a real customer.
  environment: process.env.NODE_ENV === "production" ? "demo" : "development",

  // A demo store is broken on purpose several times an hour. Without this,
  // every scenario run looks like a regression in the release notes.
  initialScope: { tags: { "drop.demo": "true" } },

  // Unset DSN makes the SDK inert. That is correct — but it must be *visible*,
  // not assumed, which is why configured.sentry() drives the /demo banner
  // instead of leaving a dark error tracker to be discovered mid-demonstration.
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()),
} as const;
