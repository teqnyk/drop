import { configured } from "@/lib/env";
import { listScenarios } from "@/lib/scenarios";
import { DemoControls } from "./controls";

export const dynamic = "force-dynamic";

/**
 * The demonstration control centre (PRD §10).
 *
 * Never linked from the storefront. Requires the demo secret, which is passed
 * as `?secret=` here and forwarded by the client to the API — a shared secret
 * in a URL is not authentication, and this page does not pretend otherwise:
 * it guards a set of switches on a fictional shop, and proper auth arrives with
 * the creator dashboard's Supabase work.
 */
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ secret?: string }>;
}) {
  const { secret } = await searchParams;

  if (!configured.demo()) {
    return (
      <Shell>
        <p className="muted">
          <code>DROP_DEMO_SECRET</code> is not set, so the control centre is off.
          That is the default: an unrelated deployment must not ship a public
          endpoint that can break its own checkout.
        </p>
      </Shell>
    );
  }

  if (!secret) {
    return (
      <Shell>
        <p className="muted">
          Append <code>?secret=…</code> to reach the controls.
        </p>
      </Shell>
    );
  }

  const scenarios = await listScenarios();
  return (
    <Shell>
      <DemoControls
        initial={scenarios}
        secret={secret}
        errorTracking={configured.sentry()}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 96, maxWidth: 720 }}>
      <p className="eyebrow">control centre</p>
      <h1 style={{ marginTop: 10, fontSize: 32 }}>Break things on purpose</h1>
      <p className="lede" style={{ fontSize: 16 }}>
        Every scenario expires by itself after ten minutes. The commonest live-demo
        failure is one left running from the last rehearsal, so it is designed out
        rather than remembered.
      </p>
      <div style={{ marginTop: 32 }}>{children}</div>
    </main>
  );
}
