import type { Studio } from "@/lib/types";

/**
 * A studio's banner.
 *
 * Each studio gets a mark built from its own initials plus a generated field
 * of its palette, so the three read as three identities rather than three
 * swatches. Same reasoning as the release covers: generated SVG, deterministic
 * from the slug, no image assets to 404.
 */

function rng(slug: string): () => number {
  let a = 0;
  for (let i = 0; i < slug.length; i++) a = (a + slug.charCodeAt(i) * (i + 11)) >>> 0;
  a = (a ^ 0x85_eb_ca_6b) >>> 0;
  return () => {
    a = (a + 0x6d_2b_79_f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** "Atlas & Co." → "AC". Ampersands and stray words do not belong in a mark. */
export function initials(name: string): string {
  return name
    .split(/[\s&]+/)
    .filter((word) => /[a-z]/i.test(word))
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

const W = 640;
const H = 160;

export function StudioArt({
  studio,
  banner = false,
}: {
  studio: Pick<Studio, "slug" | "name" | "palette">;
  banner?: boolean;
}) {
  const next = rng(studio.slug);
  const [from, to] = studio.palette;
  const gradientId = `studio-${studio.slug}`;

  // A drift of soft discs — enough texture to be recognisable, quiet enough
  // that the studio name stays the loudest thing on the card.
  const discs = Array.from({ length: 14 }, (_, i) => (
    <circle
      key={i}
      cx={next() * W}
      cy={next() * H}
      r={12 + next() * 46}
      fill="#ffffff"
      opacity={0.05 + next() * 0.1}
    />
  ));

  return (
    <svg
      className={`art${banner ? " art-banner" : " art-short"}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${gradientId})`} />
      {discs}
      {/* Centred, not left-aligned. preserveAspectRatio="slice" crops this
          4:1 viewBox horizontally to fill a 16:7 card, and anything anchored
          near the left edge is cropped straight off the canvas — which is
          exactly what happened to the first version of this mark. xMid is the
          one horizontal position the crop always preserves. */}
      <g transform={`translate(${W / 2} ${H / 2})`}>
        <circle r="52" fill="#ffffff" opacity="0.14" />
        <circle r="52" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.5" />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          opacity="0.95"
          style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.03em" }}
        >
          {initials(studio.name)}
        </text>
      </g>
    </svg>
  );
}
