import { redirect } from "next/navigation";
import { configured } from "@/lib/env";
import { currentCreator } from "@/lib/auth";
import { SignInForm } from "./form";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next?.startsWith("/") ? next : "/dashboard";

  if (await currentCreator()) redirect(target);

  return (
    <main className="wrap" style={{ paddingTop: 72, maxWidth: 420 }}>
      <h1>Sign in</h1>
      <p className="muted" style={{ marginTop: 10 }}>
        The creator dashboard for this store.
      </p>

      {configured.auth() ? (
        <SignInForm next={target} />
      ) : (
        <p className="banner-bad" style={{ marginTop: 20 }}>
          Sign-in is not configured on this deployment. Set{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and{" "}
          <code>DROP_CREATOR_EMAILS</code>, then redeploy.
        </p>
      )}

      <p className="muted small" style={{ marginTop: 24 }}>
        There is no sign-up. Drop is a demonstration store with one creator
        account.
      </p>
    </main>
  );
}
