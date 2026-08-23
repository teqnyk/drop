# Deploying Drop

The order below is not arbitrary. Two things force it: Stripe's webhook secret
does not exist until the endpoint does, and the endpoint needs a URL — so the
first deploy necessarily happens before payments work. And Next inlines every
`NEXT_PUBLIC_*` variable **at build time**, so those cannot be fixed afterwards
with a secret; the string is already compiled in.

Run `pnpm preflight` at every step, **with the same prefix the deploy uses** —
otherwise it reads the localhost URL from `.env.local` and correctly tells you
that would be baked into the bundle:

```bash
NEXT_PUBLIC_SITE_URL=https://drop.beaam.app pnpm preflight
```

It talks to each provider rather than checking that a variable is non-empty,
because a revoked key, an unverified sending domain and a paused project all
look identical from the outside.

---

## Build-time vs runtime — the distinction that bites

| Kind | Variables | Set where |
|---|---|---|
| **Build-time** (compiled into the bundle) | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SENTRY_DSN` | Prefixed on the deploy command |
| **Runtime** | `MONGODB_URI`, `MONGODB_DB`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `DROP_DEMO_SECRET`, `DROP_CRON_SECRET`, `DROP_CREATOR_EMAILS`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME` | `wrangler secret put` |

A build-time variable set wrongly cannot be corrected by a secret afterwards.
Beaam's own `AGENTS.md` records losing time to exactly this.

---

## 1. MongoDB Atlas

A free M0 cluster is enough — the whole dataset is ~8,000 small documents.

- Create the cluster and a database user.
- **Network Access → allow `0.0.0.0/0`.** Workers have no fixed egress IP, so
  an allowlist cannot work. Without it every page that touches the database
  500s with `MongoServerSelectionError: proxy request failed, cannot connect to
  the specified address`, while the same URI connects fine from your laptop —
  because your laptop's IP *is* allowed.
- **Do not use the `mongodb+srv://` string.** Cloudflare Workers do not
  implement `dns.resolveTxt`, so the driver cannot expand an SRV seedlist and
  fails with the same message, which reads like a network fault and is a DNS
  one. Expand it once, here:

  ```bash
  node scripts/atlas-seedlist.mjs --write
  ```

  Both forms work locally, so this is invisible until deploy. `MONGODB_DB` is
  `drop`.

`pnpm preflight` fails this check while the URI still points at localhost — a
Worker cannot reach your laptop, and that is a mistake worth catching before
the deploy rather than after.

## 2. Supabase (creator sign-in)

Drop uses a **separate Supabase organisation** from Beaam's, deliberately:
Beaam is the thing watching Drop, and a shared account would let one incident
take out both the subject and the observer.

- Create the project. Copy the URL and the **anon** key — not the service role
  key, which Drop neither needs nor stores.
- Authentication → Users → add **one** user by hand. There is no sign-up page.
- Set `DROP_CREATOR_EMAILS` to `that-address:soft-theory`.

## 3. Resend (delivery)

- Add and verify the sending domain. DNS has lead time; start it first.
- `RESEND_FROM` must be on that domain, or mail 403s at send time with a
  perfectly valid key. Preflight checks the domain, not just the key.

## 4. Beaam (the point of all this)

- Create a stack in Beaam for Drop and copy its ingest key.
- `OTEL_EXPORTER_OTLP_ENDPOINT=https://app.beaam.app/api/otlp`
- `OTEL_EXPORTER_OTLP_HEADERS=x-beaam-key=<ingest key>`
- `OTEL_SERVICE_NAME=drop`

Preflight sends one real `drop.preflight` datapoint here. A 401 is the only way
to learn an ingest key is wrong; every other check would pass with a dead one.

## 5. Stripe, first half

- Test mode. Copy `sk_test_…` into `STRIPE_SECRET_KEY` and `pk_test_…` into
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- Drop refuses any key that does not start `sk_test_`. It exists to fail on
  purpose, and a live key would make those failures real.
- Leave `STRIPE_WEBHOOK_SECRET` empty for now. It cannot exist yet.

## 6. Product files

```bash
pnpm asset:push        # builds all seven zips, uploads to the real bucket
```

The bucket (`drop-product-files`) already exists. Without this, every download
returns an honest error and the dashboard says which releases have no file.

## 7. First deploy

```bash
NEXT_PUBLIC_SITE_URL=https://drop.beaam.app \
NEXT_PUBLIC_SUPABASE_URL=… \
NEXT_PUBLIC_SUPABASE_ANON_KEY=… \
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_… \
pnpm run deploy
```

Then the runtime secrets:

```bash
for KEY in MONGODB_URI MONGODB_DB STRIPE_SECRET_KEY RESEND_API_KEY RESEND_FROM \
           DROP_DEMO_SECRET DROP_CRON_SECRET DROP_CREATOR_EMAILS \
           OTEL_EXPORTER_OTLP_ENDPOINT OTEL_EXPORTER_OTLP_HEADERS OTEL_SERVICE_NAME; do
  npx wrangler secret put "$KEY"
done
```

Attach the custom domain in the Cloudflare dashboard (Workers → drop →
Settings → Domains & Routes).

## 8. Stripe, second half

Now the URL exists:

- Stripe → Developers → Webhooks → add endpoint
  `https://drop.beaam.app/api/stripe/webhook`, event
  `checkout.session.completed` and `checkout.session.expired`.
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and
  `npx wrangler secret put STRIPE_WEBHOOK_SECRET`.

No rebuild needed — it is a runtime secret.

## 9. Seed production

```bash
pnpm seed              # against the Atlas URI, not localhost
```

The seed verifies its own writes and refuses to report success if the database
rejected any of them.

## 10. Prove it, end to end

1. Buy something with `4242 4242 4242 4242`.
2. Confirm the order appears on `/dashboard` and the email arrives.
3. Download the file from the link.
4. Break payments from `/demo?secret=…` and confirm Beaam alerts.
5. **Restore healthy state** and confirm the verification passes.

Until step 4 has produced a real alert on a real phone, Drop is deployed but
not yet doing its job.

---

## Scheduled work

Wired. `custom-worker.ts` adds a `scheduled()` handler — OpenNext's generated
worker only exports `fetch`, so without the wrapper the trigger would be
dropped and retries would exist in the code while never happening in
production, which is worse than not having them.

It runs every minute. Frequency does not change how fast attempts are spent
(the queue only claims jobs whose backoff has elapsed); it changes latency, and
on a five-minute cron the first backoff step of 30 seconds stops meaning
anything.

**Never enable Smart Placement.** Beaam's own runbooks record that it silently
stopped `scheduled()` from firing for four days.

Check it after deploy:

```bash
npx wrangler tail drop --format pretty     # look for [cron] fulfil
```

## When the demo is broken twenty minutes before a call

```bash
pnpm preflight         # which provider?
pnpm seed              # canonical state back
curl -X POST https://drop.beaam.app/api/demo \
  -H "x-demo-secret: $DROP_DEMO_SECRET" \
  -d '{"action":"restore"}'
```

The restore action verifies the purchase path rather than reporting success on
faith.
