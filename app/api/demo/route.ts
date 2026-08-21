import { NextResponse } from "next/server";
import { env, configured } from "@/lib/env";
import {
  DEFAULT_SCENARIO_TTL_MS,
  disableAllScenarios,
  disableScenario,
  enableScenario,
  listScenarios,
} from "@/lib/scenarios";
import { releases, reservations } from "@/lib/db";
import { reserveUnit, releaseUnit } from "@/lib/inventory";
import type { ScenarioType } from "@/lib/types";

export const dynamic = "force-dynamic";

const SCENARIOS: ScenarioType[] = [
  "slow_checkout",
  "payment_failure",
  "email_failure",
  "telemetry_silence",
];

/**
 * The demo control centre's API (PRD §10).
 *
 * Guarded by a shared secret, and **closed when that secret is unset** rather
 * than open. An unrelated deployment that never configured `DROP_DEMO_SECRET`
 * must not ship a public endpoint that can break its own checkout.
 */
function authorised(request: Request): boolean {
  const secret = env.demoSecret();
  if (!secret) return false;
  const provided =
    request.headers.get("x-demo-secret") ??
    new URL(request.url).searchParams.get("secret");
  return provided === secret;
}

export async function GET(request: Request) {
  if (!configured.mongo()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  if (!authorised(request)) return refuse();
  return NextResponse.json({ scenarios: await listScenarios() });
}

export async function POST(request: Request) {
  if (!configured.mongo()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  if (!authorised(request)) return refuse();

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    scenario?: ScenarioType;
    config?: Record<string, unknown>;
    ttlMs?: number;
  };

  switch (body.action) {
    case "enable": {
      if (!body.scenario || !SCENARIOS.includes(body.scenario)) {
        return NextResponse.json({ error: "unknown scenario" }, { status: 400 });
      }
      const expiresAt = await enableScenario(
        body.scenario,
        body.config ?? {},
        body.ttlMs ?? DEFAULT_SCENARIO_TTL_MS,
      );
      return NextResponse.json({
        enabled: body.scenario,
        // Always told, never assumed: a presenter needs to know when this turns
        // itself off, and a scenario whose expiry is invisible is one that
        // surprises you mid-demo.
        expires_at: expiresAt.toISOString(),
      });
    }

    case "disable": {
      if (!body.scenario) return NextResponse.json({ error: "no scenario" }, { status: 400 });
      await disableScenario(body.scenario);
      return NextResponse.json({ disabled: body.scenario });
    }

    case "restore": {
      // "Restore healthy state" (PRD §10) — and it VERIFIES rather than
      // asserts. Turning the flags off and reporting success without checking
      // is the same class of lie the whole application argues against.
      await disableAllScenarios();
      await (await reservations()).deleteMany({ status: "held" });

      const verification = await verifyHealthy();
      return NextResponse.json(
        { restored: true, verified: verification.ok, checks: verification.checks },
        { status: verification.ok ? 200 : 500 },
      );
    }

    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}

function refuse() {
  // 404, not 403: an unauthorised caller learns nothing about whether a demo
  // control centre exists here at all.
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/**
 * Prove the principal journey works, rather than claiming it does.
 *
 * Reserves a real unit through the real code path and gives it straight back —
 * so a restore that reports healthy has actually exercised inventory, not just
 * cleared some flags.
 */
async function verifyHealthy(): Promise<{ ok: boolean; checks: Record<string, string> }> {
  const checks: Record<string, string> = {};

  const release = await (await releases()).findOne({ slug: "form-01" });
  checks.release = release ? `found, status ${release.status}` : "MISSING — run pnpm seed";
  if (!release) return { ok: false, checks };

  const held = await reserveUnit("form-01");
  if (!held.ok) {
    checks.reserve = `FAILED: ${held.reason}`;
    return { ok: false, checks };
  }
  checks.reserve = "ok";

  const returned = await releaseUnit(held.purchaseId);
  checks.release_hold = returned ? "ok" : "FAILED to return the unit";

  const after = await (await releases()).findOne({ slug: "form-01" });
  const restored = after?.quantity_remaining === release.quantity_remaining;
  checks.stock = restored
    ? `unchanged at ${after?.quantity_remaining}`
    : `DRIFTED ${release.quantity_remaining} → ${after?.quantity_remaining}`;

  return { ok: returned && restored, checks };
}
