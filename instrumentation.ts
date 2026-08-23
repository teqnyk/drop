import * as Sentry from "@sentry/nextjs";

/** How often the delivery queue is worked. See the note in startFulfilment. */
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Work the delivery queue on an interval.
 *
 * On Cloudflare this was a cron trigger and a `scheduled()` handler. Fly has no
 * equivalent built in, and an in-process interval is the smaller thing: it
 * needs no second machine, and it cannot drift out of step with the app it is
 * sweeping for.
 *
 * **Safe to run on every machine.** Two instances sweeping at once is not a
 * duplicate send — runFulfilment claims each job with a guarded update on
 * `attempts` before working it, so the loser of the race skips it. That claim
 * was written for the retry logic and pays for itself again here.
 *
 * Every minute, because the backoff's first step is 30 seconds; a longer
 * interval would make that step mean nothing. It does not spend attempts
 * faster — jobs whose `next_attempt_at` has not passed are not claimed.
 */
function startFulfilment() {
  const timer = setInterval(async () => {
    try {
      const { runFulfilment } = await import("./lib/fulfilment");
      const result = await runFulfilment();
      // Only when something happened. A line a minute saying "0 0 0 0" buries
      // the one that matters.
      if (result.attempted > 0) {
        console.log(`[fulfil] ${JSON.stringify(result)}`);
      }
    } catch (error) {
      // Logged, never thrown. A sweep that crashes the process would take the
      // storefront down to fix an email.
      console.error(
        `[fulfil] sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, SWEEP_INTERVAL_MS);

  // Do not hold the process open on its own account.
  timer.unref?.();
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    startFulfilment();
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
