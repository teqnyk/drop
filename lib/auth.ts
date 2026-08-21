import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { configured, env } from "./env";

/**
 * Creator identity (PRD §22 — Supabase Auth, identity only).
 *
 * Supabase holds nothing but the account. Every piece of application data
 * stays in MongoDB, so this is an auth dependency rather than a second
 * database, and swapping it later touches only this file.
 *
 * Two separate questions, deliberately kept apart:
 *
 *   1. Is there a valid session?      — Supabase answers this.
 *   2. Is that person the creator?    — DROP_CREATOR_EMAILS answers this.
 *
 * Conflating them is the mistake worth naming: a Supabase project accepts
 * public signups unless you turn them off, so "logged in" would otherwise mean
 * "anyone on the internet who filled in a form" — on a page that lists buyers'
 * email addresses and can pause the release.
 */

export type Creator = { id: string; email: string };

/** Server client bound to the request's cookies. Never use the service role. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        // In a Server Component this throws; the middleware is what refreshes
        // the session, so swallowing it here is correct rather than lossy.
        try {
          for (const { name, value, options } of items) store.set(name, value, options);
        } catch {
          // Deliberate: Server Components cannot set cookies. The middleware
          // has already written the refreshed session for this request.
        }
      },
    },
  });
}

/**
 * The signed-in creator, or null.
 *
 * Returns null for a valid session belonging to someone who is not on the
 * allowlist — that is a real outcome, not an error, and the sign-in page says
 * so in words rather than looping the person back to a form that "worked".
 */
export async function currentCreator(): Promise<Creator | null> {
  if (!configured.auth()) return null;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  const email = data.user.email.toLowerCase();
  if (!env.creatorEmails().includes(email)) return null;
  return { id: data.user.id, email };
}

/**
 * Whether an unauthenticated dashboard is tolerable here.
 *
 * Only in local development, and only while auth is unconfigured — so a
 * deployment that forgets the environment variables gets a locked door and an
 * explanation, not an open control panel. `NODE_ENV` is fixed at build time,
 * so no missing or malformed variable can flip this in production.
 */
export function authBypassAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && !configured.auth();
}

/**
 * Gate for anything that acts as the creator.
 *
 * Server actions are POST endpoints with public URLs; gating the page that
 * renders the buttons and not the actions behind them leaves the controls
 * reachable by anyone who reads the page source. Every action calls this.
 */
export async function requireCreator(): Promise<Creator> {
  if (authBypassAllowed()) return { id: "local-dev", email: "local@dev" };
  const creator = await currentCreator();
  if (!creator) throw new Error("Not signed in as the creator.");
  return creator;
}
