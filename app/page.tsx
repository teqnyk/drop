import Link from "next/link";
import { headers } from "next/headers";
import { releases, studios } from "@/lib/db";
import { deviceKind, recordEvent, referrerHost } from "@/lib/events";
import { configured } from "@/lib/env";
import { emitAsync, metrics } from "@/lib/telemetry";
import { ReleaseTile } from "@/components/release-tile";
import { StudioArt } from "@/components/studio-art";
import type { Release, Studio } from "@/lib/types";

/**
 * Drop's homepage.
 *
 * Drop is the platform; a studio is a tenant (PRD §1 — "a storefront for
 * creators", plural). Showing a single studio here would make Drop and Soft
 * Theory the same thing, which is not the product being demonstrated.
 *
 * Renders from the collections, never from a constant. PRD §8 is explicit and
 * the reason is the demo itself: a hardcoded homepage keeps working during a
 * database outage, which is precisely the failure Drop exists to show.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!configured.mongo()) return <NotConfigured />;

  const [allStudios, allReleases] = await Promise.all([
    (await studios()).find({}).toArray(),
    (await releases()).find({}).toArray(),
  ]);
  if (allStudios.length === 0) return <NotSeeded />;

  const live = allReleases
    .filter((r) => r.status === "live" && r.quantity_remaining > 0)
    .sort(
      (a, b) =>
        new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime(),
    );

  const countFor = (slug: string) => allReleases.filter((r) => r.studio_slug === slug).length;

  const h = await headers();
  emitAsync(metrics.storefrontView({ release: "home" }));
  void recordEvent({
    type: "view",
    releaseSlug: "home",
    referrer: referrerHost(h.get("referer")),
    device: deviceKind(h.get("user-agent")),
  });

  return (
    <main className="wrap" style={{ paddingTop: 56, paddingBottom: 96 }}>
      <section className="hero">
        <p className="eyebrow">drop</p>
        <h1 className="hero-title">Small releases. Big launch energy.</h1>
        <p className="lede hero-lede">
          A home for independent studios selling limited digital editions. Fixed
          quantities, instant delivery, and no quiet restocking — when an
          edition is gone, it is gone.
        </p>
        <p className="muted small">
          <Link href="/architecture">See how Drop is built and watched →</Link>
        </p>
      </section>

      <h2 className="section-head">Studios</h2>
      <ul className="grid" aria-label="Studios">
        {allStudios.map((studio) => (
          <li key={studio.slug}>
            <StudioCard studio={studio} releaseCount={countFor(studio.slug)} />
          </li>
        ))}
      </ul>

      <h2 className="section-head" style={{ marginTop: 56 }}>
        Available now
      </h2>
      {live.length === 0 ? (
        <p className="muted">Every edition is currently sold out or paused.</p>
      ) : (
        <ul className="grid" aria-label="Releases available now">
          {live.map((release) => (
            <li key={release.slug}>
              <ReleaseTile release={release as Release} showStudio />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function StudioCard({ studio, releaseCount }: { studio: Studio; releaseCount: number }) {
  return (
    <Link href={`/studios/${studio.slug}`} className="tile">
      <StudioArt studio={studio} />
      <span className="tile-body">
        <span className="tile-head">
          <span className="tile-title">{studio.name}</span>
        </span>
        <span className="muted small tile-tagline">{studio.tagline}</span>
        <span className="muted small">
          {studio.creator_name} · {studio.location} · {releaseCount}{" "}
          {releaseCount === 1 ? "release" : "releases"}
        </span>
      </span>
    </Link>
  );
}

function NotConfigured() {
  return (
    <main className="wrap" style={{ paddingTop: 64 }}>
      <h1>Not configured</h1>
      <p className="muted" style={{ marginTop: 12 }}>
        <code>MONGODB_URI</code> is not set, so there is nothing to show. Copy{" "}
        <code>.env.example</code> to <code>.env.local</code> and fill it in.
      </p>
    </main>
  );
}

function NotSeeded() {
  return (
    <main className="wrap" style={{ paddingTop: 64 }}>
      <h1>Nothing here yet</h1>
      <p className="muted" style={{ marginTop: 12 }}>
        The database is reachable but holds no studios. Run <code>pnpm seed</code>.
      </p>
    </main>
  );
}
