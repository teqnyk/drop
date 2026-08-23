import Link from "next/link";

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

type Box = {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  w?: number;
  tone: "app" | "data" | "provider" | "watch";
};

const W = 132;
const H = 54;

const BOXES: Box[] = [
  { id: "browser", label: "Browser", sub: "storefront · dashboard", x: 24, y: 20, tone: "app" },
  { id: "worker", label: "Next.js on Workers", sub: "OpenNext · edge", x: 24, y: 118, w: 292, tone: "app" },

  { id: "mongo", label: "MongoDB", sub: "releases · orders · events", x: 24, y: 216, tone: "data" },
  { id: "r2", label: "R2", sub: "product files", x: 184, y: 216, tone: "data" },

  { id: "stripe", label: "Stripe", sub: "payments, test mode", x: 372, y: 20, tone: "provider" },
  { id: "resend", label: "Resend", sub: "confirmation email", x: 372, y: 96, tone: "provider" },
  { id: "supabase", label: "Supabase", sub: "creator identity", x: 372, y: 172, tone: "provider" },
  { id: "sentry", label: "Sentry", sub: "exceptions", x: 372, y: 248, tone: "provider" },

  { id: "beaam", label: "Beaam", sub: "detects · alerts", x: 560, y: 118, w: 152, tone: "watch" },
];

type Edge = {
  from: string;
  to: string;
  label?: string;
  dash?: boolean;
  /**
   * Explicit waypoints, for an edge whose straight line would cross a box it
   * has nothing to do with. Drawn as a right-angled route rather than nudging
   * the layout until it happens to miss — a diagram where one line passes
   * through an unrelated service is a diagram that asserts a dependency that
   * does not exist.
   */
  route?: [number, number][];
};

const EDGES: Edge[] = [
  { from: "browser", to: "worker" },
  { from: "worker", to: "mongo" },
  { from: "worker", to: "r2" },
  { from: "worker", to: "stripe" },
  { from: "worker", to: "resend" },
  { from: "worker", to: "supabase" },
  { from: "worker", to: "sentry", dash: true },
  // Straight from the worker to Beaam would pass through Resend. Routed
  // beneath the provider column instead.
  { from: "worker", to: "beaam", label: "OTLP", route: [[170, 292], [636, 292]] },
];

function box(id: string): Box {
  const found = BOXES.find((b) => b.id === id);
  if (!found) throw new Error(`Unknown box: ${id}`);
  return found;
}

function centre(b: Box) {
  return { x: b.x + (b.w ?? W) / 2, y: b.y + H / 2 };
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

  const halfW = (to.w ?? W) / 2 + 4; // +4 keeps the arrowhead off the stroke
  const halfH = H / 2 + 4;
  // Scale the vector until it first leaves the target rectangle, then step
  // BACK from the centre by that much. `b` is already the centre — adding a
  // half-width to it again pushed every endpoint a box-width off target.
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
          <svg viewBox="0 0 736 320" role="img" aria-labelledby="arch-title arch-desc">
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
            </defs>

            {EDGES.map((edge) => {
              const from = box(edge.from);
              const to = box(edge.to);
              const routed = edge.route && edge.route.length > 0;

              // A routed edge leaves and enters vertically; a straight one
              // takes the shortest path between the two borders.
              const a = routed
                ? { x: edge.route![0][0], y: from.y + H }
                : borderPoint(to, from);
              const b = routed
                ? { x: edge.route![edge.route!.length - 1][0], y: to.y + H }
                : borderPoint(from, to);

              const points = routed
                ? [a, ...edge.route!.map(([x, y]) => ({ x, y })), b]
                : [a, b];

              const mid = routed
                ? { x: (edge.route![0][0] + edge.route![1][0]) / 2, y: edge.route![0][1] }
                : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

              return (
                <g key={`${edge.from}-${edge.to}`}>
                  <polyline
                    points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke="var(--line-strong)"
                    strokeWidth="1.25"
                    strokeDasharray={edge.dash ? "4 3" : undefined}
                    markerEnd="url(#arrow)"
                  />
                  {edge.label ? (
                    <>
                      {/* A plate behind the text, or the line reads through
                          the letters and neither is legible. */}
                      <rect
                        x={mid.x - 20}
                        y={mid.y - 15}
                        width="40"
                        height="14"
                        rx="3"
                        fill="var(--card)"
                      />
                      <text x={mid.x} y={mid.y - 5} className="diagram-edge-label" textAnchor="middle">
                        {edge.label}
                      </text>
                    </>
                  ) : null}
                </g>
              );
            })}

            {BOXES.map((b) => (
              <g key={b.id} className={`diagram-box diagram-${b.tone}`}>
                <rect x={b.x} y={b.y} width={b.w ?? W} height={H} rx="8" />
                <text x={b.x + 12} y={b.y + 22} className="diagram-label">
                  {b.label}
                </text>
                <text x={b.x + 12} y={b.y + 39} className="diagram-sub">
                  {b.sub}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <figcaption className="muted small">
          Dashed: Sentry receives exceptions only. Beaam receives OpenTelemetry
          from the application and polls every provider directly.
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
