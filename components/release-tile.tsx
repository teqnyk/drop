import Link from "next/link";
import { money } from "@/lib/format";
import { ReleaseArt } from "./release-art";
import type { Release } from "@/lib/types";

/**
 * One release, as a card.
 *
 * Shared by the homepage and each studio's shopfront. `showStudio` is the only
 * difference between them — on a studio's own page the studio name is already
 * the heading, and repeating it on every tile is noise.
 */
export function ReleaseTile({
  release,
  showStudio = false,
}: {
  release: Release;
  showStudio?: boolean;
}) {
  const soldOut = release.status === "sold_out" || release.quantity_remaining <= 0;
  const paused = release.status === "paused" || release.status === "draft";
  const remaining = release.quantity_remaining;
  // "Nearly gone" is a fact here, not a growth tactic: it is read from the
  // edition, and it stops being true the moment the number does.
  const nearlyGone = !soldOut && !paused && remaining <= release.quantity_total * 0.15;

  return (
    <Link href={`/releases/${release.slug}`} className="tile">
      <ReleaseArt release={release} />
      <span className="tile-body">
        <span className="tile-head">
          <span className="tile-title">{release.title}</span>
          <span className="tile-price">{money(release.price_amount, release.currency)}</span>
        </span>
        {showStudio ? (
          <span className="muted small tile-studio">{release.studio_name}</span>
        ) : null}
        <span className="muted small tile-tagline">{release.tagline}</span>
        <span className="tile-status">
          {soldOut ? (
            <span className="pill pill-failed">Sold out</span>
          ) : paused ? (
            <span className="pill">Paused</span>
          ) : nearlyGone ? (
            <span className="pill pill-warn">{remaining} left</span>
          ) : (
            <span className="muted small">
              {remaining} of {release.quantity_total} left
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
