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
export function BuyButton({ slug, soldOut }: { slug: string; soldOut: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (soldOut) {
    return (
      <button className="btn" disabled aria-disabled>
        Sold out
      </button>
    );
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
      <button className="btn" onClick={buy} disabled={pending}>
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
