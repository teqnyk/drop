"use client";

import { useState } from "react";

type Scenario = { type: string; active: boolean; expiresAt: string | null };

const LABELS: Record<string, { title: string; detail: string }> = {
  slow_checkout: {
    title: "Slow checkout",
    detail: "Adds four seconds to the real checkout path, so the latency is genuine.",
  },
  payment_failure: {
    title: "Payment failure",
    detail: "Declines every attempt. The storefront stays up — this is the argument.",
  },
  email_failure: {
    title: "Email failure",
    detail: "Purchases complete and downloads work; only confirmation fails.",
  },
  frontend_exception: {
    title: "Frontend exception",
    detail:
      "The buy button throws in the browser. Nothing is reserved and no payment starts — this is the one failure server instrumentation cannot see.",
  },
  telemetry_silence: {
    title: "Telemetry silence",
    detail: "Keeps serving traffic, stops reporting. Healthy vs not observable.",
  },
};

export function DemoControls({
  initial,
  secret,
  errorTracking,
}: {
  initial: Scenario[];
  secret: string;
  /**
   * Whether Sentry has a DSN. The frontend-exception scenario proves nothing
   * without it — the button breaks, nobody is told, and the demonstration
   * quietly makes the opposite of its point. Better said here than discovered
   * in front of an audience.
   */
  errorTracking: boolean;
}) {
  const [scenarios, setScenarios] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function call(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setResult(null);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json", "x-demo-secret": secret },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setResult(`Failed: ${JSON.stringify(json)}`);
      } else if (body.action === "restore") {
        // Report what was actually verified, not "done". A restore that says
        // success without evidence is the failure this app argues against.
        setResult(
          json.verified
            ? `Restored and verified — ${JSON.stringify(json.checks)}`
            : `Restored but VERIFICATION FAILED — ${JSON.stringify(json.checks)}`,
        );
      }
      const list = await fetch(`/api/demo?secret=${encodeURIComponent(secret)}`);
      if (list.ok) setScenarios(((await list.json()) as { scenarios: Scenario[] }).scenarios);
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
    }
    setBusy(null);
  }

  return (
    <>
      {!errorTracking ? (
        <p className="banner-bad" style={{ marginBottom: 20 }}>
          <strong>Error tracking is off.</strong> <code>NEXT_PUBLIC_SENTRY_DSN</code>{" "}
          is unset, so the frontend-exception scenario will break the buy button
          and report the exception nowhere. Set it before demonstrating that one.
        </p>
      ) : null}

      <div className="scenarios">
        {scenarios.map((s) => {
          const meta = LABELS[s.type] ?? { title: s.type, detail: "" };
          return (
            <div key={s.type} className={`scenario${s.active ? " on" : ""}`}>
              <div style={{ minWidth: 0 }}>
                <p className="scenario-title">
                  {meta.title}
                  {s.active ? <span className="pill pill-failed" style={{ marginLeft: 8 }}>active</span> : null}
                </p>
                <p className="muted small">{meta.detail}</p>
                {s.active && s.expiresAt ? (
                  <p className="muted small" style={{ marginTop: 4 }}>
                    Expires {new Date(s.expiresAt).toLocaleTimeString()}
                  </p>
                ) : null}
              </div>
              <button
                className="btn btn-small"
                disabled={busy === s.type}
                onClick={() =>
                  call({ action: s.active ? "disable" : "enable", scenario: s.type }, s.type)
                }
              >
                {busy === s.type ? "…" : s.active ? "Turn off" : "Turn on"}
              </button>
            </div>
          );
        })}
      </div>

      <button
        className="btn"
        style={{ marginTop: 24 }}
        disabled={busy === "restore"}
        onClick={() => call({ action: "restore" }, "restore")}
      >
        {busy === "restore" ? "Restoring and verifying…" : "Restore healthy state"}
      </button>

      {result ? <p className="notice small" style={{ marginTop: 16 }}>{result}</p> : null}
    </>
  );
}
