"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * The last line of defence: an error that escaped every boundary below it.
 *
 * Reported to Sentry AND shown to the person, with the digest. Next replaces
 * the message with an opaque digest in production; printing it is the only way
 * a customer can quote something that leads back to the actual error, and
 * "something went wrong" with nothing to quote is a support ticket that cannot
 * be answered.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="wrap" style={{ paddingTop: 72, maxWidth: 620 }}>
          <p className="eyebrow">something broke</p>
          <h1 style={{ marginTop: 12, fontSize: 34 }}>This page hit an error.</h1>
          <p className="lede" style={{ fontSize: 17 }}>
            Nothing you did caused it and no payment was affected. If you were
            part-way through a purchase, check your email — an order that
            completed stays completed whatever this page does.
          </p>
          {error.digest ? (
            <p className="muted small" style={{ marginTop: 20 }}>
              Reference: <code>{error.digest}</code>
            </p>
          ) : null}
          <p style={{ marginTop: 28, display: "flex", gap: 12 }}>
            <button className="btn" onClick={reset}>Try again</button>
          </p>
        </main>
      </body>
    </html>
  );
}
