import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { SCENARIO_TYPES } from "../lib/types";

/**
 * Scenario wiring.
 *
 * The scenario list used to exist three times: a TS union in lib/types.ts and
 * runtime copies in lib/scenarios.ts and the /demo route. A fifth scenario
 * could be listable but not enablable, or enablable and invisible, depending
 * on which copies got updated — and either way the control centre would look
 * complete while one switch did nothing.
 */

describe("the scenario list", () => {
  it("exists exactly once, with no runtime copies left behind", () => {
    const scenarios = readFileSync("lib/scenarios.ts", "utf8");
    const route = readFileSync("app/api/demo/route.ts", "utf8");
    for (const source of [scenarios, route]) {
      expect(source).toContain("SCENARIO_TYPES");
      // A re-typed array literal is the regression. Both files must reference
      // the shared constant rather than list the names again.
      expect(source).not.toMatch(/\[\s*"slow_checkout"/);
    }
  });

  it("gives every scenario a label in the control centre", () => {
    const controls = readFileSync("app/demo/controls.tsx", "utf8");
    for (const type of SCENARIO_TYPES) {
      // An unlabelled scenario falls back to its raw key with an empty
      // description — a switch nobody can explain mid-demonstration.
      expect(controls).toContain(`${type}: {`);
    }
  });

  it("includes the frontend exception PRD §10 requires", () => {
    // Named rather than merely counted: this is the only scenario that proves
    // client-side error reporting, which server instrumentation cannot see.
    expect(SCENARIO_TYPES).toContain("frontend_exception");
  });

  it("has no duplicates", () => {
    expect(new Set(SCENARIO_TYPES).size).toBe(SCENARIO_TYPES.length);
  });
});

describe("Sentry configuration", () => {
  it("reports errors without taking over tracing", async () => {
    const { sentryOptions } = await import("../sentry.shared");
    // Beaam owns telemetry. Two tracing systems over one request produce two
    // partial pictures and an argument about which is right.
    expect(sentryOptions.tracesSampleRate).toBe(0);
  });

  it("tags everything as a demo", async () => {
    const { sentryOptions } = await import("../sentry.shared");
    // A store that is broken on purpose several times an hour otherwise reads
    // as a product in freefall.
    expect(sentryOptions.initialScope.tags["drop.demo"]).toBe("true");
  });

  it("does not ship session replay", async () => {
    const shared = readFileSync("sentry.shared.ts", "utf8");
    // Replay records the DOM and the dashboard renders buyers' email
    // addresses. This is a privacy boundary, not a preference.
    expect(shared).not.toContain("replayIntegration");
    expect(shared).not.toContain("replaysSessionSampleRate");
  });
});

describe("the request-time gate", () => {
  it("stays middleware.ts and does not become proxy.ts", () => {
    // Next 16 deprecates this filename and nags about it in the dev log, so
    // renaming it looks like tidy-up. It is not: proxy.ts defaults to the
    // Node.js runtime, its runtime option cannot be overridden ("Setting the
    // runtime config option in Proxy will throw an error"), and OpenNext then
    // refuses the entire worker with "Node.js middleware is not currently
    // supported". The app stops being deployable, and `next build` still
    // passes — which is exactly how it shipped unnoticed once already.
    expect(existsSync("middleware.ts")).toBe(true);
    expect(existsSync("proxy.ts")).toBe(false);

    const source = readFileSync("middleware.ts", "utf8");
    expect(source).toContain("export async function middleware");
    // The reason must travel with the file, or the next person deletes the
    // guard along with the warning.
    expect(source).toContain("must not be renamed to proxy.ts");
  });
});
