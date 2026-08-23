import type { Release } from "@/lib/types";

/**
 * Generated cover art.
 *
 * A flat gradient tells you nothing about what you are buying. Each release
 * gets a pattern drawn from what it *is* — a glyph grid for icons, a baseline
 * for a layout system, letterforms for a typeface, a waveform for field
 * recordings, contours for maps, frames for photography.
 *
 * SVG generated from the slug rather than image files, for the reason
 * everything visual here is: an <img> is one more asset that can 404 during
 * exactly the outage this application exists to demonstrate, and seven covers
 * would be seven more.
 *
 * Deterministic — the same slug always draws the same picture, so a screenshot
 * taken today matches one taken next month (PRD §24).
 */

export type ArtKind = "glyphs" | "baseline" | "letterform" | "waveform" | "contour" | "frames";

/** Mulberry32, seeded from the slug. See lib/history.ts for why not Math.random. */
function rng(slug: string): () => number {
  let a = 0;
  for (let i = 0; i < slug.length; i++) a = (a + slug.charCodeAt(i) * (i + 7)) >>> 0;
  a = (a ^ 0x9e_37_79_b9) >>> 0;
  return () => {
    a = (a + 0x6d_2b_79_f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const W = 320;
const H = 200;

function Glyphs({ next }: { next: () => number }) {
  // A grid of small marks — the shape of an icon set contact sheet.
  const cols = 6;
  const rows = 4;
  const cell = W / cols;
  const marks = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = c * cell + cell / 2;
      const cy = r * (H / rows) + H / rows / 2;
      const pick = next();
      const size = 11;
      marks.push(
        pick < 0.33 ? (
          <circle key={`${r}-${c}`} cx={cx} cy={cy} r={size * 0.62} />
        ) : pick < 0.66 ? (
          <rect key={`${r}-${c}`} x={cx - size / 2} y={cy - size / 2} width={size} height={size} rx="3" />
        ) : (
          <path
            key={`${r}-${c}`}
            d={`M${cx - size / 2} ${cy} L${cx} ${cy - size / 2} L${cx + size / 2} ${cy} L${cx} ${cy + size / 2} Z`}
          />
        ),
      );
    }
  }
  return <g fill="currentColor" opacity="0.92">{marks}</g>;
}

function Baseline() {
  // Ruled lines with blocks sitting on them — a layout system, literally.
  const lines = [];
  for (let y = 16; y < H; y += 16) {
    lines.push(<line key={`l${y}`} x1="0" y1={y} x2={W} y2={y} stroke="currentColor" strokeWidth="0.6" opacity="0.28" />);
  }
  const blocks = [
    [24, 32, 120, 32],
    [24, 80, 72, 16],
    [112, 80, 88, 16],
    [24, 112, 176, 48],
    [216, 32, 80, 128],
  ];
  return (
    <g>
      {lines}
      {blocks.map(([x, y, w, h]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="2" fill="currentColor" opacity="0.85" />
      ))}
    </g>
  );
}

function Letterform() {
  // One oversized glyph, cropped — the way a type specimen opens.
  return (
    <g fill="currentColor">
      <text x={W / 2} y={H * 0.86} textAnchor="middle" style={{ fontSize: 190, fontFamily: "ui-monospace, monospace", fontWeight: 500 }}>
        Aa
      </text>
    </g>
  );
}

function Waveform({ next }: { next: () => number }) {
  // A stereo pair, drawn as mirrored bars.
  const bars = 46;
  const step = W / bars;
  const out = [];
  for (let i = 0; i < bars; i++) {
    // Enveloped rather than uniform, so it reads as a recording and not a bar chart.
    const envelope = Math.sin((i / bars) * Math.PI) ** 0.6;
    const h = Math.max(3, envelope * (0.25 + next() * 0.75) * (H / 2 - 12));
    out.push(
      <rect key={i} x={i * step + 1.5} y={H / 2 - h} width={step - 3} height={h * 2} rx={1.5} fill="currentColor" opacity="0.9" />,
    );
  }
  return <g>{out}</g>;
}

function Contour({ next }: { next: () => number }) {
  // Nested closed curves — shaded relief, at a glance.
  const rings = [];
  const cx = W * (0.4 + next() * 0.2);
  const cy = H * (0.4 + next() * 0.2);
  for (let i = 8; i >= 1; i--) {
    const rx = i * 17 + next() * 6;
    const ry = i * 11 + next() * 6;
    rings.push(
      <ellipse
        key={i}
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="none"
        stroke="currentColor"
        strokeWidth={i === 1 ? 2 : 1}
        opacity={0.3 + (9 - i) * 0.07}
        transform={`rotate(${-18 + next() * 36} ${cx} ${cy})`}
      />,
    );
  }
  return <g>{rings}</g>;
}

function Frames({ next }: { next: () => number }) {
  // Scattered rectangles with a light border — a contact sheet of photographs.
  const out = [];
  for (let i = 0; i < 5; i++) {
    const w = 62 + next() * 46;
    const h = w * (0.66 + next() * 0.3);
    out.push(
      <rect
        key={i}
        x={16 + next() * (W - w - 32)}
        y={12 + next() * (H - h - 24)}
        width={w}
        height={h}
        rx="2"
        fill="currentColor"
        opacity={0.55 + next() * 0.4}
        stroke="currentColor"
        strokeWidth="3"
      />,
    );
  }
  return <g>{out}</g>;
}

export function ReleaseArt({
  release,
  short = false,
}: {
  release: Pick<Release, "slug" | "palette" | "art">;
  short?: boolean;
}) {
  const next = rng(release.slug);
  const [from, to] = release.palette;
  const gradientId = `art-${release.slug}`;

  const pattern =
    release.art === "glyphs" ? <Glyphs next={next} />
    : release.art === "baseline" ? <Baseline />
    : release.art === "letterform" ? <Letterform />
    : release.art === "waveform" ? <Waveform next={next} />
    : release.art === "contour" ? <Contour next={next} />
    : <Frames next={next} />;

  return (
    <svg
      className={`art${short ? " art-short" : ""}`}
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
      {/* The pattern is drawn in the paper colour at low opacity, so it reads
          as texture on the gradient rather than as a second illustration. */}
      <g color="#ffffff" opacity="0.5">{pattern}</g>
    </svg>
  );
}
