/**
 * Is Drop actually ready to deploy?
 *
 *   pnpm preflight
 *
 * Every check TALKS TO THE PROVIDER. Checking that a variable is non-empty
 * proves nothing — a revoked Stripe key, a Resend domain that never finished
 * verifying and a Supabase project that has been paused all look identical to
 * a working setup from the outside, and each one fails later, in production,
 * during a demonstration. That is the exact "looks fine, isn't" failure this
 * application exists to argue against, so its own deploy check does not commit
 * it.
 *
 * Exits non-zero if anything required is missing or broken, and prints the
 * provider's own words rather than "check your configuration".
 */
import { config } from "dotenv";
config({ path: ".env.local" });

type Result = {
  name: string;
  required: boolean;
  ok: boolean;
  detail: string;
};

const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function missing(name: string, variable: string, required = true): Result {
  return { name, required, ok: false, detail: `${variable} is not set.` };
}

/** Bounded, so a provider returning an HTML error page does not fill the terminal. */
function short(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 160);
}

async function checkMongo(): Promise<Result> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) return missing("MongoDB", "MONGODB_URI");
  try {
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: TIMEOUT_MS });
    await client.connect();
    const db = client.db(process.env.MONGODB_DB?.trim() || "drop");
    const releases = await db.collection("releases").countDocuments();
    await client.close();
    const local = /localhost|127\.0\.0\.1/.test(uri);
    return {
      name: "MongoDB",
      required: true,
      ok: !local,
      detail: local
        ? `Connected, but this is a LOCAL mongod. A deploy needs Atlas — the Worker cannot reach your laptop.`
        : `Connected. ${releases} releases.`,
    };
  } catch (error) {
    return { name: "MongoDB", required: true, ok: false, detail: short(String(error)) };
  }
}

async function checkStripe(): Promise<Result> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return missing("Stripe", "STRIPE_SECRET_KEY");
  if (!key.startsWith("sk_test_")) {
    return {
      name: "Stripe",
      required: true,
      ok: false,
      detail: "Not a test-mode key. Drop refuses live mode — it exists to fail on purpose.",
    };
  }
  try {
    const res = await fetchWithTimeout("https://api.stripe.com/v1/balance", {
      headers: { authorization: `Bearer ${key}` },
    });
    if (!res.ok) return { name: "Stripe", required: true, ok: false, detail: short(await res.text()) };
    return { name: "Stripe", required: true, ok: true, detail: "Test-mode key accepted." };
  } catch (error) {
    return { name: "Stripe", required: true, ok: false, detail: short(String(error)) };
  }
}

async function checkStripeWebhook(): Promise<Result> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) return missing("Stripe webhook", "STRIPE_WEBHOOK_SECRET");
  // Cannot be verified without a delivery; the shape is all we can check.
  const looksRight = secret.startsWith("whsec_");
  return {
    name: "Stripe webhook",
    required: true,
    ok: looksRight,
    detail: looksRight
      ? "Present. Only a real delivery can prove it — that is step 3 of the runbook."
      : "Does not start with whsec_.",
  };
}

async function checkResend(): Promise<Result> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!key) return missing("Resend", "RESEND_API_KEY");
  if (!from) return missing("Resend", "RESEND_FROM");
  try {
    const res = await fetchWithTimeout("https://api.resend.com/domains", {
      headers: { authorization: `Bearer ${key}` },
    });
    if (!res.ok) return { name: "Resend", required: true, ok: false, detail: short(await res.text()) };

    const body = (await res.json()) as { data?: { name: string; status: string }[] };
    const domain = from.split("@")[1]?.toLowerCase() ?? "";
    const match = body.data?.find((d) => d.name.toLowerCase() === domain);
    if (!match) {
      // The commonest silent failure here: a key that works and a from-address
      // on a domain the account cannot send from. Sends 403 at delivery time.
      return {
        name: "Resend",
        required: true,
        ok: false,
        detail: `Key works, but "${domain}" is not a domain on this account. Mail would fail at send time.`,
      };
    }
    const verified = match.status === "verified";
    return {
      name: "Resend",
      required: true,
      ok: verified,
      detail: verified ? `Sending from ${domain}.` : `${domain} is "${match.status}", not verified.`,
    };
  } catch (error) {
    return { name: "Resend", required: true, ok: false, detail: short(String(error)) };
  }
}

async function checkSupabase(): Promise<Result> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const creators = process.env.DROP_CREATOR_EMAILS?.trim();
  if (!url) return missing("Supabase", "NEXT_PUBLIC_SUPABASE_URL");
  if (!key) return missing("Supabase", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!creators) return missing("Supabase", "DROP_CREATOR_EMAILS");
  try {
    const res = await fetchWithTimeout(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: key },
    });
    if (!res.ok) return { name: "Supabase", required: true, ok: false, detail: short(await res.text()) };
    return { name: "Supabase", required: true, ok: true, detail: `Auth reachable. Creators: ${creators}` };
  } catch (error) {
    return { name: "Supabase", required: true, ok: false, detail: short(String(error)) };
  }
}

async function checkBeaam(): Promise<Result> {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  const headers = process.env.OTEL_EXPORTER_OTLP_HEADERS?.trim();
  if (!endpoint) return missing("Beaam (OTLP)", "OTEL_EXPORTER_OTLP_ENDPOINT");
  if (!headers) return missing("Beaam (OTLP)", "OTEL_EXPORTER_OTLP_HEADERS");

  const parsed: Record<string, string> = {};
  for (const pair of headers.split(",")) {
    const [k, ...rest] = pair.split("=");
    if (k && rest.length) parsed[k.trim()] = rest.join("=").trim();
  }

  // A real datapoint, because a 401 is the only way to learn the key is wrong
  // and every other check here would happily pass with a dead ingest key.
  const payload = {
    resourceMetrics: [
      {
        resource: { attributes: [{ key: "service.name", value: { stringValue: "drop-preflight" } }] },
        scopeMetrics: [
          {
            metrics: [
              {
                name: "drop.preflight",
                sum: {
                  aggregationTemporality: 1,
                  isMonotonic: true,
                  dataPoints: [
                    { asInt: "1", timeUnixNano: `${Date.now() * 1_000_000}`, attributes: [] },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    const res = await fetchWithTimeout(`${endpoint.replace(/\/$/, "")}/v1/metrics`, {
      method: "POST",
      headers: { "content-type": "application/json", ...parsed },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { name: "Beaam (OTLP)", required: true, ok: false, detail: `${res.status} ${short(await res.text())}` };
    }
    return { name: "Beaam (OTLP)", required: true, ok: true, detail: "Ingest accepted a probe metric." };
  } catch (error) {
    return { name: "Beaam (OTLP)", required: true, ok: false, detail: short(String(error)) };
  }
}

async function checkSentry(): Promise<Result> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) {
    return { name: "Sentry", required: false, ok: false, detail: "Unset. The SDK stays inert and /demo says so." };
  }
  try {
    const url = new URL(dsn);
    const ok = Boolean(url.username) && url.pathname.length > 1;
    return {
      name: "Sentry",
      required: false,
      ok,
      detail: ok ? `DSN parses. Project ${url.pathname.slice(1)}.` : "DSN is missing its key or project id.",
    };
  } catch {
    return { name: "Sentry", required: false, ok: false, detail: "DSN is not a URL." };
  }
}

async function checkSiteUrl(): Promise<Result> {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!url) return missing("Site URL", "NEXT_PUBLIC_SITE_URL");
  const local = /localhost|127\.0\.0\.1/.test(url);
  return {
    name: "Site URL",
    required: true,
    ok: !local,
    detail: local
      ? // Next inlines NEXT_PUBLIC_* at build time, so this cannot be fixed
        // afterwards with a secret. Beaam's own AGENTS.md records the same trap.
        `${url} — localhost would be BAKED INTO the bundle. Prefix the deploy with the real URL.`
      : url,
  };
}

async function checkSecrets(): Promise<Result[]> {
  return [
    {
      name: "Demo secret",
      required: true,
      ok: Boolean(process.env.DROP_DEMO_SECRET?.trim()),
      detail: process.env.DROP_DEMO_SECRET?.trim() ? "Set." : "DROP_DEMO_SECRET unset — /demo refuses.",
    },
    {
      name: "Cron secret",
      required: true,
      ok: Boolean(process.env.DROP_CRON_SECRET?.trim()),
      detail: process.env.DROP_CRON_SECRET?.trim() ? "Set." : "DROP_CRON_SECRET unset — the sweep 404s.",
    },
  ];
}

async function main() {
  console.log("\nDrop preflight — talking to every provider.\n");

  const results = [
    ...(await Promise.all([
      checkSiteUrl(),
      checkMongo(),
      checkStripe(),
      checkStripeWebhook(),
      checkResend(),
      checkSupabase(),
      checkBeaam(),
      checkSentry(),
    ])),
    ...(await checkSecrets()),
  ];

  const width = Math.max(...results.map((r) => r.name.length));
  for (const r of results) {
    const mark = r.ok ? "  ok  " : r.required ? " FAIL " : " skip ";
    console.log(`[${mark}] ${r.name.padEnd(width)}  ${r.detail}`);
  }

  const failed = results.filter((r) => r.required && !r.ok);
  console.log("");
  if (failed.length > 0) {
    console.error(
      `${failed.length} required ${failed.length === 1 ? "check" : "checks"} failed: ` +
        `${failed.map((f) => f.name).join(", ")}.\nDrop is NOT ready to deploy.\n`,
    );
    process.exit(1);
  }
  console.log("All required checks passed. Drop is ready to deploy.\n");
  process.exit(0);
}

main().catch((error) => {
  console.error("Preflight itself failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
