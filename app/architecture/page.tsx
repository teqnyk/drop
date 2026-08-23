import Link from "next/link";
import { DiagramIcon, type IconKind } from "@/components/diagram-icons";

export const metadata = {
  title: "How it works — Drop",
  description: "The architecture behind Drop, and what watches it.",
};

/**
 * The architecture, drawn.
 *
 * Hand-written SVG rather than a rendering library: the whole page must survive
 * the outages this shop demonstrates, and a diagram that needs a CDN script is
 * a diagram that goes blank exactly when someone is trying to understand the
 * incident. It is also the honest medium — there are eleven boxes here, not a
 * dataset.
 */

type Tone = "app" | "data" | "provider" | "watch";

export type Box = {
  id: string;
  label: string;
  sub: string;
  icon: IconKind;
  x: number;
  y: number;
  w: number;
  h: number;
  tone: Tone;
};

/**
 * The layout is arithmetic, not taste.
 *
 * The provider column leaves an 18px gap between Resend and Supabase, and the
 * worker box is centred on it (y 131 + 64/2 = 163; the gap runs 154–172). That
 * is what lets the OTLP edge cross to Beaam as a straight horizontal line
 * without passing through a provider — a diagram whose line crosses an
 * unrelated service asserts a dependency that does not exist.
 *
 * Add a provider and that gap closes. Move the column, not the edge.
 */
export const BOXES: Box[] = [
  // Browser and Workers are both Drop's own code and are drawn the same width,
  // so the left column reads as one stack rather than as boxes sized by how
  // much text each happened to need. The data row beneath sums to the same
  // 314, which is why MongoDB and R2 are 150 apiece with a 14px gutter.
  { id: "browser", label: "Browser", sub: "storefront · dashboard", icon: "browser", x: 24, y: 24, w: 314, h: 58, tone: "app" },
  { id: "worker", label: "Next.js on Workers", sub: "OpenNext · edge runtime", icon: "worker", x: 24, y: 131, w: 314, h: 64, tone: "app" },

  { id: "mongo", label: "MongoDB", sub: "all Drop's data", icon: "mongodb", x: 24, y: 252, w: 150, h: 58, tone: "data" },
  { id: "r2", label: "R2", sub: "product files", icon: "cloudflare", x: 188, y: 252, w: 150, h: 58, tone: "data" },

  // The 18px gutters are load-bearing: the worker is centred on the one at
  // y 154–172 so the OTLP line can cross to Beaam without passing through a
  // provider. Add a provider here and that gutter closes.
  { id: "stripe", label: "Stripe", sub: "payments, test mode", icon: "stripe", x: 372, y: 20, w: 172, h: 58, tone: "provider" },
  { id: "resend", label: "Resend", sub: "confirmation email", icon: "resend", x: 372, y: 96, w: 172, h: 58, tone: "provider" },
  { id: "supabase", label: "Supabase", sub: "creator identity", icon: "supabase", x: 372, y: 172, w: 172, h: 58, tone: "provider" },
  { id: "sentry", label: "Sentry", sub: "exceptions", icon: "sentry", x: 372, y: 248, w: 172, h: 58, tone: "provider" },

  // The subject of the page, and sized like it: a full-height column that
  // every other box reports into. Beaam was previously a 128-wide card off to
  // one side, which drew it as the ninth service rather than as the thing the
  // other eight are being watched by.
  { id: "beaam", label: "Beaam", sub: "detects · correlates · alerts", icon: "beaam", x: 596, y: 20, w: 164, h: 286, tone: "watch" },
];

/**
 * Where a box's text starts, and how much room it has after it.
 *
 * Exported because SVG text neither wraps nor clips — it draws straight over
 * whatever is beside it. "releases · orders · events" ran under R2 and
 * "storefront · dashboard" ran out of the Browser box, both invisible to every
 * check that existed. tests/architecture.test.ts measures against these.
 */
export const TEXT_INSET = 42;
export const TEXT_PADDING = 12;

type Edge = {
  from: string;
  to: string;
  label?: string;
  /** Sentry only receives what breaks, so its edge is drawn as an exception. */
  dash?: boolean;
  /** Animate a pulse along it — reserved for the continuous flows. */
  flow?: boolean;
};

export const EDGES: Edge[] = [
  { from: "browser", to: "worker", flow: true },
  { from: "worker", to: "mongo", flow: true },
  { from: "worker", to: "r2" },
  { from: "worker", to: "stripe" },
  { from: "worker", to: "resend" },
  { from: "worker", to: "supabase" },
  { from: "worker", to: "sentry", dash: true },
];

/**
 * What Beaam watches.
 *
 * Drawn separately and faintly, because these are not Drop's dependencies —
 * they are observations of them, and drawing them the same weight would say
 * Drop calls Beaam nine times. The caption claimed Beaam "connects to every
 * provider directly" while the diagram showed a single line from the worker;
 * a page whose picture contradicts its own caption teaches the wrong thing
 * twice.
 */
export const WATCHES: { from: string; label?: string }[] = [
  { from: "worker", label: "OTLP" },
  { from: "mongo" },
  { from: "r2" },
  { from: "stripe" },
  { from: "resend" },
  { from: "supabase" },
  { from: "sentry" },
];

/** The rail every observation joins before entering Beaam. */
export const RAIL_X = 566;
/** Below every box, so the left column can reach the rail without crossing one. */
export const RAIL_FLOOR = 322;

/**
 * The path from a watched box to the rail.
 *
 * Right-hand boxes go straight across. The worker leaves through the 18px gap
 * the provider column deliberately leaves at y 154–172. MongoDB and R2 drop
 * below everything first — a horizontal line from either would cross Sentry,
 * which would draw Beaam as watching a service through another service.
 */
export function watchPath(from: Box): { x: number; y: number }[] {
  const cy = from.y + from.h / 2;
  // Keyed off the tone, not an x threshold. The previous version tested
  // `x + w > 340` with R2's right edge sitting at 338 — two pixels away from
  // silently routing a data store straight through Sentry.
  if (from.tone === "provider" || from.id === "worker") {
    return [{ x: from.x + from.w, y: cy }, { x: RAIL_X, y: cy }];
  }
  const cx = from.x + from.w / 2;
  return [
    { x: cx, y: from.y + from.h },
    { x: cx, y: RAIL_FLOOR },
    { x: RAIL_X, y: RAIL_FLOOR },
  ];
}

function box(id: string): Box {
  const found = BOXES.find((b) => b.id === id);
  if (!found) throw new Error(`Unknown box: ${id}`);
  return found;
}

function centre(b: Box) {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/**
 * Where a centre-to-centre line crosses a box's border.
 *
 * Drawing centre to centre buries both arrowheads under the boxes, which is
 * how a diagram ends up with lines that appear to pass *through* services
 * rather than terminate at them. Clipping to the border is what makes the
 * direction of every dependency readable at a glance.
 */
function borderPoint(from: Box, to: Box) {
  const a = centre(from);
  const b = centre(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return b;

  const halfW = to.w / 2 + 5; // keeps the arrowhead clear of the stroke
  const halfH = to.h / 2 + 5;
  const scale = Math.min(
    dx === 0 ? Infinity : halfW / Math.abs(dx),
    dy === 0 ? Infinity : halfH / Math.abs(dy),
  );
  return { x: b.x - dx * scale, y: b.y - dy * scale };
}

export default function ArchitecturePage() {
  return (
    <main className="wrap prose" style={{ paddingTop: 48, paddingBottom: 96 }}>
      <p className="eyebrow">how it works</p>
      <h1>What is behind Drop</h1>
      <p className="lede">
        Every box below is a real service doing real work — payments in test
        mode, files in object storage, email that actually sends. Nothing here is
        stubbed for the demonstration, because a stubbed dependency cannot fail,
        and the failures are the point.
      </p>

      <figure className="diagram diagram-wide">
        <div className="diagram-scroll">
          <svg viewBox="0 0 776 330" role="img" aria-labelledby="arch-title arch-desc">
            <title id="arch-title">Drop&rsquo;s architecture</title>
            <desc id="arch-desc">
              The browser talks to a Next.js application on Cloudflare Workers.
              That application reads and writes MongoDB and Cloudflare R2, and
              calls Stripe for payments, Resend for email, Supabase for creator
              identity and Sentry for exceptions. It exports OpenTelemetry to
              Beaam, which monitors every one of those dependencies.
            </desc>

            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--line-strong)" />
              </marker>
              <marker id="arrow-watch" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--watch)" opacity="0.7" />
              </marker>
            </defs>

            {EDGES.map((edge) => {
              const from = box(edge.from);
              const to = box(edge.to);
              const a = borderPoint(to, from);
              const b = borderPoint(from, to);
              const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

              return (
                <g key={`${edge.from}-${edge.to}`}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="var(--line-strong)"
                    strokeWidth="1.25"
                    strokeDasharray={edge.dash ? "4 3" : undefined}
                    markerEnd="url(#arrow)"
                  />

                  {/* A pulse travelling the edge, on the flows that never stop:
                      the browser's requests, the writes to Mongo, and the
                      telemetry going to Beaam. Purely decorative, and disabled
                      outright under prefers-reduced-motion. */}
                  {edge.flow ? (
                    <line
                      className="edge-flow"
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="var(--accent)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      pathLength={100}
                    />
                  ) : null}

                  {edge.label ? (
                    <>
                      {/* A plate behind the text, or the line reads through the
                          letters and neither is legible. */}
                      <rect x={mid.x - 22} y={mid.y - 9} width="44" height="18" rx="4" fill="var(--card)" />
                      <text x={mid.x} y={mid.y + 4} className="diagram-edge-label" textAnchor="middle">
                        {edge.label}
                      </text>
                    </>
                  ) : null}
                </g>
              );
            })}

            {/* Beaam's observations. They join a rail and enter as one, rather
                than as seven arrows — Drop does not call Beaam seven times, and
                seven arrowheads would say it does. */}
            <g className="watch-rail">
              {WATCHES.map((watch) => {
                const from = box(watch.from);
                const points = watchPath(from);
                const label = watch.label
                  ? { x: (points[0].x + points[1].x) / 2, y: points[0].y }
                  : null;
                return (
                  <g key={`watch-${watch.from}`}>
                    <polyline
                      points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="none"
                      stroke="var(--watch)"
                      strokeWidth="1.1"
                      strokeDasharray="3 4"
                      opacity="0.5"
                    />
                    {label ? (
                      <>
                        <rect x={label.x - 22} y={label.y - 9} width="44" height="18" rx="4" fill="var(--card)" />
                        <text x={label.x} y={label.y + 4} className="diagram-edge-label" textAnchor="middle">
                          {watch.label}
                        </text>
                      </>
                    ) : null}
                  </g>
                );
              })}

              <line
                x1={RAIL_X}
                y1={box("stripe").y + box("stripe").h / 2}
                x2={RAIL_X}
                y2={RAIL_FLOOR}
                stroke="var(--watch)"
                strokeWidth="1.4"
                opacity="0.55"
              />
              <line
                x1={RAIL_X}
                y1={box("worker").y + box("worker").h / 2}
                x2={box("beaam").x - 6}
                y2={box("worker").y + box("worker").h / 2}
                stroke="var(--watch)"
                strokeWidth="1.4"
                opacity="0.8"
                markerEnd="url(#arrow-watch)"
              />
            </g>

            {BOXES.map((b) => (
              <g key={b.id} className={`diagram-box diagram-${b.tone}`}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="10" />
                {b.tone === "watch" ? (
                  <>
                    <DiagramIcon kind={b.icon} x={b.x + b.w / 2 - 22} y={b.y + 96} size={44} />
                    <text x={b.x + b.w / 2} y={b.y + 176} className="diagram-hero-label" textAnchor="middle">
                      {b.label}
                    </text>
                    <text x={b.x + b.w / 2} y={b.y + 198} className="diagram-sub" textAnchor="middle">
                      detects · correlates
                    </text>
                    <text x={b.x + b.w / 2} y={b.y + 214} className="diagram-sub" textAnchor="middle">
                      alerts
                    </text>
                  </>
                ) : (
                  <>
                    <DiagramIcon kind={b.icon} x={b.x + 13} y={b.y + b.h / 2 - 8.6} />
                    <text x={b.x + TEXT_INSET} y={b.y + b.h / 2 - 3} className="diagram-label">
                      {b.label}
                    </text>
                    <text x={b.x + TEXT_INSET} y={b.y + b.h / 2 + 13} className="diagram-sub">
                      {b.sub}
                    </text>
                  </>
                )}
              </g>
            ))}
          </svg>
        </div>

        <figcaption>
          <ul className="diagram-key">
            <li><span className="key-swatch key-app" />Drop&rsquo;s own code</li>
            <li><span className="key-swatch key-data" />State it owns</li>
            <li><span className="key-swatch key-provider" />Third-party providers</li>
            <li><span className="key-swatch key-watch" />What watches it all</li>
            <li><span className="key-dash" />Exceptions only</li>
          </ul>
          <p className="muted small">
            Beaam receives OpenTelemetry from the application and also connects
            to every provider directly, so it can tell &ldquo;Drop is
            broken&rdquo; from &ldquo;a dependency is broken&rdquo;.
          </p>
        </figcaption>
      </figure>

      <h2>The rules Drop is built on</h2>

      <h3>A failure never becomes a plausible success</h3>
      <p>
        If the email fails, the order stays complete and the download keeps
        working — and the dashboard says <em>email failed</em> with the provider&rsquo;s
        own words, not a red dot. If the product file is missing, a valid
        download link returns an error rather than a zero-byte file the browser
        cheerfully saves. Silence is the failure mode this whole application
        argues against.
      </p>

      <h3>Inventory cannot go negative</h3>
      <p>
        A purchase decrements stock in one guarded atomic update — never a read
        followed by a write. Two people clicking buy on the last copy is a race
        the database resolves, not the application.
      </p>

      <h3>A replayed webhook cannot double-sell</h3>
      <p>
        Orders are idempotent by unique index rather than by checking first. The
        second insert fails with a duplicate key, which is the correct outcome
        and is handled as success. Stripe retries webhooks; that is not
        hypothetical.
      </p>

      <h3>Retries are finite, and giving up is visible</h3>
      <p>
        A failed delivery retries four times with backoff and then stops — and
        says it stopped. &ldquo;Failed&rdquo; and &ldquo;failed and nobody is
        still trying&rdquo; need different actions from the creator, so they are
        never the same word.
      </p>

      <h2>Watching it</h2>
      <p>
        Beaam receives OpenTelemetry from every request and connects to each
        provider directly, so it can tell the difference between{" "}
        <em>this shop is broken</em> and <em>a dependency is broken</em>. The{" "}
        <Link href="/">shop</Link> can be broken on purpose to demonstrate that:
        slow checkout, declined payments, failed email, an uncaught browser
        exception, or telemetry going silent while traffic carries on.
      </p>
      <p className="muted small">
        Source: <a href="https://github.com/teqnyk/drop">github.com/teqnyk/drop</a>.
      </p>
    </main>
  );
}
