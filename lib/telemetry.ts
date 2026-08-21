import { activeScenario } from "./scenarios";

/**
 * OpenTelemetry metrics, as OTLP/JSON, straight to Beaam.
 *
 * Hand-rolled rather than the full SDK, for three reasons that are all about
 * this being a demonstration:
 *
 *  1. Beaam's ingest accepts **JSON only** — it parses the body and answers
 *     `415 Send OTLP/JSON (application/json)` otherwise. The SDK's default is
 *     `http/protobuf`, so the first thing most people hit is a 415. Emitting
 *     JSON directly makes the happy path the only path.
 *  2. It runs on Workers without a Node-only dependency graph.
 *  3. A reader can see exactly what is sent. For a reference implementation
 *     that is the feature, not a shortcut.
 *
 * Not a general-purpose exporter: no histograms, no batching across requests,
 * no retry queue. Drop's request volume is a demo's, and a queue that can drop
 * silently is the wrong thing to teach.
 */
type Attributes = Record<string, string | number | boolean>;

type Counter = { name: string; value: number; attributes: Attributes };

function endpoint(): string | null {
  const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  return base ? `${base.replace(/\/$/, "")}/metrics` : null;
}

/** `Authorization=Bearer bik_…` — the OTLP header convention Beaam documents. */
function headers(): Record<string, string> {
  const out: Record<string, string> = { "content-type": "application/json" };
  const raw = process.env.OTEL_EXPORTER_OTLP_HEADERS?.trim();
  if (!raw) return out;
  for (const pair of raw.split(",")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return out;
}

function serviceName(): string {
  return process.env.OTEL_SERVICE_NAME?.trim() || "drop-storefront";
}

/**
 * Send one or more counter samples.
 *
 * Never throws and never blocks the caller's own work: telemetry that can fail
 * a checkout is worse than no telemetry. But it does not vanish either — a
 * failed export is logged, because "we stopped reporting" is exactly the
 * condition Beaam is being shown detecting.
 */
export async function emit(counters: Counter[]): Promise<void> {
  const url = endpoint();
  if (!url || counters.length === 0) return;

  // The telemetry-silence scenario (PRD §10): keep serving traffic, stop
  // reporting. Drop looks healthy from the outside while Beaam loses sight of
  // it — the distinction between "healthy" and "not currently observable".
  if (await activeScenario("telemetry_silence")) return;

  const now = String(Date.now() * 1_000_000); // OTLP wants nanoseconds
  const payload = {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: serviceName() } },
            { key: "service.namespace", value: { stringValue: "drop-production" } },
          ],
        },
        scopeMetrics: [
          {
            scope: { name: "drop" },
            metrics: counters.map((c) => ({
              name: c.name,
              sum: {
                aggregationTemporality: 2, // DELTA
                isMonotonic: true,
                dataPoints: [
                  {
                    asDouble: c.value,
                    timeUnixNano: now,
                    startTimeUnixNano: now,
                    attributes: Object.entries(c.attributes).map(([key, value]) => ({
                      key,
                      value:
                        typeof value === "number"
                          ? { doubleValue: value }
                          : typeof value === "boolean"
                            ? { boolValue: value }
                            : { stringValue: value },
                    })),
                  },
                ],
              },
            })),
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.text().then((t) => t.slice(0, 200)).catch(() => "");
      console.error(`[otel] export rejected ${res.status}: ${detail}`);
    }
  } catch (error) {
    console.error(`[otel] export failed: ${error instanceof Error ? error.message : error}`);
  }
}

/** Fire-and-forget: telemetry must never be on the critical path. */
export function emitAsync(counters: Counter[]): void {
  void emit(counters);
}

export const metrics = {
  storefrontView: (attrs: Attributes = {}) => [
    { name: "drop.storefront.views", value: 1, attributes: attrs },
  ],
  checkoutStarted: (latencyMs: number, attrs: Attributes = {}) => [
    { name: "drop.checkout.started", value: 1, attributes: attrs },
    { name: "drop.checkout.latency_ms", value: latencyMs, attributes: attrs },
  ],
  checkoutFailed: (reason: string, attrs: Attributes = {}) => [
    { name: "drop.checkout.failed", value: 1, attributes: { reason, ...attrs } },
  ],
  purchaseCompleted: (amount: number, attrs: Attributes = {}) => [
    { name: "drop.orders.completed", value: 1, attributes: attrs },
    { name: "drop.orders.revenue_minor", value: amount, attributes: attrs },
  ],
  emailOutcome: (status: string, attrs: Attributes = {}) => [
    { name: "drop.email.dispatched", value: 1, attributes: { status, ...attrs } },
  ],
  downloadServed: (attrs: Attributes = {}) => [
    { name: "drop.downloads.served", value: 1, attributes: attrs },
  ],
  inventoryRemaining: (remaining: number, attrs: Attributes = {}) => [
    { name: "drop.inventory.remaining", value: remaining, attributes: attrs },
  ],
};
