"use client";

import { useState } from "react";

/**
 * The purchase call to action.
 *
 * Client-side because it needs a pending state: checkout creates a reservation
 * and a payment session before redirecting, and the demo deliberately makes
 * that slow. A button that looks inert while four seconds pass is how a
 * customer double-submits.
 */
export function BuyButton({
  slug,
  soldOut,
  throwOnClick = false,
}: {
  slug: string;
  soldOut: boolean;
  /**
   * The frontend-exception scenario (PRD §10). Throws from the click handler
   * before any network call, so nothing is reserved and no payment is started
   * — the failure is purely in the browser, which is the point: it proves the
   * error reaches Sentry from the client, where server instrumentation cannot
   * see it.
   */
  throwOnClick?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (soldOut) {
    return (
      <button className="btn" disabled aria-disabled>
        Sold out
      </button>
    );
  }

  /**
   * The click handler proper.
   *
   * Throws SYNCHRONOUSLY when the scenario is on. Throwing inside `buy`, which
   * is async, would produce an unhandled promise rejection instead — Sentry
   * catches those too, but it files them as a different kind of event, and the
   * scenario is meant to demonstrate an uncaught exception in the browser.
   * Reproducing the wrong failure convincingly is worse than not reproducing
   * it at all.
   */
  function onBuyClick() {
    if (throwOnClick) {
      // Deliberately uncaught: the global handler is what catches an exception
      // thrown from an event handler, and reporting it by hand here would
      // exercise a path no real bug takes.
      throw new Error(
        "Drop demo: controlled checkout exception (frontend_exception scenario)",
      );
    }
    void buy();
  }

  async function buy() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        // The reason, not "something went wrong". A customer who is told the
        // edition just sold out behaves differently from one told to retry.
        setError(body.error ?? "Checkout is unavailable right now.");
        setPending(false);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Couldn't reach the store. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <>
      <button className="btn" onClick={onBuyClick} disabled={pending}>
        {pending ? "Taking you to checkout…" : "Get the collection"}
      </button>
      {error ? (
        <p className="error small" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
