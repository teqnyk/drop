"use server";

import { redirect } from "next/navigation";
import { configured, env } from "@/lib/env";
import { supabaseServer } from "@/lib/auth";

/**
 * Sign in. There is deliberately no sign-up.
 *
 * Drop has exactly one creator account, created by hand in the Supabase
 * dashboard. A public demo that lets visitors register their way toward the
 * release controls would be a strange thing for an application whose subject
 * is operational honesty.
 */
export async function signIn(_prev: string | undefined, form: FormData) {
  if (!configured.auth()) {
    return "Sign-in is not configured on this deployment.";
  }

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/dashboard");

  if (!email || !password) return "Enter an email address and a password.";

  // Checked before the credentials so a non-creator gets the real reason
  // rather than "wrong password" — the account may be perfectly valid and
  // simply not the creator's, and saying otherwise sends them to reset a
  // password that was never the problem.
  if (!env.creatorEmails().includes(email)) {
    return "That account is not the creator of this store.";
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  // The provider's own words, bounded — not "something went wrong".
  if (error) return error.message.slice(0, 200);

  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function signOut() {
  if (configured.auth()) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  }
  redirect("/signin");
}
