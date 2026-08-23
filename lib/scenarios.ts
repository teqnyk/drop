import { demoScenarios } from "./db";
import { configured } from "./env";
import { SCENARIO_TYPES, type ScenarioType } from "./types";

/**
 * Demo scenarios (PRD §10).
 *
 * Every scenario carries its own expiry and the read below honours it, so a
 * scenario left on from the last rehearsal turns itself off. That is the single
 * most common live-demo failure, and the cheapest to design out: expiry is a
 * property of the record, not a job that has to run.
 */
export const DEFAULT_SCENARIO_TTL_MS = 10 * 60 * 1000;

export async function activeScenario(type: ScenarioType): Promise<Record<string, unknown> | null> {
  if (!configured.mongo()) return null;
  try {
    const col = await demoScenarios();
    const doc = await col.findOne({
      scenario_type: type,
      disabled_at: null,
      expires_at: { $gt: new Date() },
    });
    return doc ? doc.configuration : null;
  } catch (error) {
    // A scenario lookup that fails must not break the storefront. Drop is
    // healthy by default; an unreadable control centre means "no scenario", not
    // "everything is broken".
    console.error(
      `[scenarios] could not read ${type}: ${error instanceof Error ? error.message : error}`,
    );
    return null;
  }
}

/** Apply the configured latency for a scenario, if it is active. */
export async function scenarioDelay(type: ScenarioType): Promise<void> {
  const config = await activeScenario(type);
  if (!config) return;
  const ms = typeof config.delay_ms === "number" ? config.delay_ms : 4000;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function enableScenario(
  type: ScenarioType,
  configuration: Record<string, unknown> = {},
  ttlMs: number = DEFAULT_SCENARIO_TTL_MS,
): Promise<Date> {
  const expiresAt = new Date(Date.now() + ttlMs);
  const col = await demoScenarios();
  await col.updateOne(
    { scenario_type: type },
    {
      $set: {
        scenario_type: type,
        configuration,
        enabled_at: new Date().toISOString(),
        expires_at: expiresAt,
        disabled_at: null,
      },
    },
    { upsert: true },
  );
  return expiresAt;
}

export async function disableScenario(type: ScenarioType): Promise<void> {
  const col = await demoScenarios();
  await col.updateOne(
    { scenario_type: type },
    { $set: { disabled_at: new Date().toISOString(), expires_at: new Date(0) } },
  );
}

/** Turn everything off — the "Restore healthy state" half that clears flags. */
export async function disableAllScenarios(): Promise<void> {
  const col = await demoScenarios();
  await col.updateMany(
    { disabled_at: null },
    { $set: { disabled_at: new Date().toISOString(), expires_at: new Date(0) } },
  );
}

export async function listScenarios(): Promise<
  { type: ScenarioType; active: boolean; expiresAt: string | null }[]
> {
  const types: readonly ScenarioType[] = SCENARIO_TYPES;
  const col = await demoScenarios();
  const docs = await col.find({}).toArray();
  return types.map((type) => {
    const doc = docs.find((d) => d.scenario_type === type);
    const active = Boolean(
      doc && !doc.disabled_at && doc.expires_at > new Date(),
    );
    return {
      type,
      active,
      expiresAt: active && doc ? doc.expires_at.toISOString() : null,
    };
  });
}
