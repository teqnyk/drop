import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Server-side errors reach Sentry through this hook. Without it, a thrown
 * error in a route handler or Server Component renders a 500 and is never
 * reported — the app would look instrumented and record nothing.
 */
export const onRequestError = Sentry.captureRequestError;
