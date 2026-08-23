import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { releases, studios } from "@/lib/db";
import { deviceKind, recordEvent, referrerHost } from "@/lib/events";
import { configured } from "@/lib/env";
import { emitAsync, metrics } from "@/lib/telemetry";
import { ReleaseTile } from "@/components/release-tile";
import { StudioArt } from "@/components/studio-art";
import type { Release } from "@/lib/types";

/** A studio's shopfront — one tenant's releases on Drop. */
export const dynamic = "force-dynamic";

export default async function StudioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!configured.mongo()) {
    return (
      <main className="wrap" style={{ paddingTop: 64 }}>
        <h1>Not configured</h1>
        <p className="muted" style={{ marginTop: 12 }}>
          <code>MONGODB_URI</code> is not set.
        </p>
      </main>
    );
  }

  const studio = await (await studios()).findOne({ slug });
  if (!studio) notFound();

  const catalogue = await (await releases()).find({ studio_slug: slug }).toArray();
  // Anything still buyable outranks anything that is not — a shopfront whose
  // first tile is sold out is a shopfront that looks closed.
  const order = (r: Release) => (r.status === "live" ? 0 : r.status === "paused" ? 1 : 2);
  const sorted = [...catalogue].sort(
    (a, b) =>
      order(a) - order(b) ||
      new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime(),
  );

  const h = await headers();
  emitAsync(metrics.storefrontView({ release: `studio:${slug}` }));
  void recordEvent({
    type: "view",
    releaseSlug: `studio:${slug}`,
    referrer: referrerHost(h.get("referer")),
    device: deviceKind(h.get("user-agent")),
  });

  return (
    <main className="wrap" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <p className="muted small" style={{ marginBottom: 24 }}>
        <Link href="/">← All studios</Link>
      </p>

      <StudioArt studio={studio} banner />

      <header className="studio-head">
        <h1>{studio.name}</h1>
        <p className="lede">{studio.bio}</p>
        <p className="muted small">
          {studio.creator_name} · {studio.location} · on Drop since{" "}
          {new Date(studio.joined_at).getFullYear()}
        </p>
      </header>

      {sorted.length === 0 ? (
        <p className="muted">No releases yet.</p>
      ) : (
        <ul className="grid" aria-label={`Releases by ${studio.name}`}>
          {sorted.map((release) => (
            <li key={release.slug}>
              <ReleaseTile release={release as Release} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
