import { describe, expect, it, beforeEach, afterEach } from "vitest";

/**
 * The dashboard boundary.
 *
 * These test the two decisions that are easy to get wrong and impossible to
 * notice: what an *unconfigured* deployment does, and whether a valid session
 * is treated as proof of being the creator. Both fail open if written
 * carelessly, and neither shows up in normal use — the page looks identical
 * either way to the one person who is supposed to see it.
 */

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "DROP_CREATOR_EMAILS",
  "NODE_ENV",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function configure(on: boolean) {
  if (on) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.DROP_CREATOR_EMAILS = "creator@example.com";
  } else {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.DROP_CREATOR_EMAILS;
  }
}

describe("the unconfigured case", () => {
  it("does not open the dashboard in production", async () => {
    const { authBypassAllowed } = await import("../lib/auth");
    configure(false);
    process.env.NODE_ENV = "production";
    // The whole point: forgetting the environment variables must produce a
    // locked door, not a public control panel that can pause the release.
    expect(authBypassAllowed()).toBe(false);
  });

  it("opens the dashboard in local development, where it announces itself", async () => {
    const { authBypassAllowed } = await import("../lib/auth");
    configure(false);
    process.env.NODE_ENV = "development";
    expect(authBypassAllowed()).toBe(true);
  });

  it("never bypasses once auth IS configured, even in development", async () => {
    const { authBypassAllowed } = await import("../lib/auth");
    configure(true);
    process.env.NODE_ENV = "development";
    expect(authBypassAllowed()).toBe(false);
  });

  it("treats a partially configured deployment as unconfigured", async () => {
    const { configured } = await import("../lib/env");
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    delete process.env.DROP_CREATOR_EMAILS;
    // Supabase alone lets anyone who signs up through the front door. The
    // allowlist is not optional hardening; it is half of the check.
    expect(configured.auth()).toBe(false);
  });
});

describe("the creator allowlist", () => {
  it("is empty when unset, so a session alone admits nobody", async () => {
    const { env } = await import("../lib/env");
    delete process.env.DROP_CREATOR_EMAILS;
    expect(env.creatorEmails()).toEqual([]);
  });

  it("ignores case and surrounding whitespace", async () => {
    const { env } = await import("../lib/env");
    process.env.DROP_CREATOR_EMAILS = " Creator@Example.com , second@example.com ";
    expect(env.creatorEmails()).toEqual(["creator@example.com", "second@example.com"]);
  });

  it("does not admit an address that merely contains a listed one", async () => {
    const { env } = await import("../lib/env");
    process.env.DROP_CREATOR_EMAILS = "creator@example.com";
    const list = env.creatorEmails();
    // A substring check here would admit creator@example.com.attacker.test.
    expect(list.includes("creator@example.com.attacker.test")).toBe(false);
    expect(list.includes("creator@example.com")).toBe(true);
  });

  it("drops empty entries from a trailing comma rather than admitting ''", async () => {
    const { env } = await import("../lib/env");
    process.env.DROP_CREATOR_EMAILS = "creator@example.com,,";
    expect(env.creatorEmails()).toEqual(["creator@example.com"]);
  });
});
