"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export function SignInForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(signIn, undefined);

  return (
    <form action={action} className="signin-form">
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label className="field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error ? <p className="banner-bad">{error}</p> : null}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
