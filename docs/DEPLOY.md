# Deploying Drop

Drop runs on **Fly.io**, not Cloudflare Workers.

It was built for Workers and deployed there on 2026-08-23. Every page that
touches the database failed intermittently: a fresh isolate answered in ~1.2s,
then after three to six requests that isolate poisoned permanently and every
later query failed in ~50ms. Workers cap simultaneous outbound connections at
six per invocation and the MongoDB driver's sockets from earlier invocations
keep counting. Seven fixes were tried and measured; `lib/db.ts` lists them.
Moving to a Node host fixed it outright — 35 consecutive requests, no failures.

R2 stays Cloudflare's, now over its S3-compatible API rather than a binding, so
the stack Beaam monitors is unchanged.

Run `pnpm preflight` at every step, **with the same values the deploy uses**. It
talks to each provider rather than checking that a variable is non-empty,
because a revoked key, an unverified sending domain and a paused project all
look identical from the outside.

```bash
NEXT_PUBLIC_SITE_URL=https://drop.beaam.app pnpm preflight
```

---

## Build-time vs runtime — the distinction that bites

| Kind | Variables | Set where |
|---|---|---|
| **Build-time** (compiled into the bundle) | `NEXT_PUBLIC_*` | `--build-arg` on `fly deploy` |
| **Runtime** | everything else, **and the `NEXT_PUBLIC_*` again** | `fly secrets import` |

The `NEXT_PUBLIC_*` values appear in both columns and that is not a mistake.
Next inlines them into client bundles at build time, but server components read
`process.env` at runtime — so setting them only as build args left `/signin`
returning 500 with "NEXT_PUBLIC_SUPABASE_URL is not set" while the storefront
worked fine.

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
fly deploy --app beaam-drop --remote-only \
  --build-arg NEXT_PUBLIC_SITE_URL=https://drop.beaam.app \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=… \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=… \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_… \
  --build-arg NEXT_PUBLIC_SENTRY_DSN=…
```

Then the runtime values. Use `secrets import`, not `secrets set`: the OTLP
header is `Authorization=Bearer bik_…` and the space in it does not survive
being assembled into a shell command line.

```bash
fly secrets import --app beaam-drop < <(grep -E '^[A-Z_]+=.+' .env.local)
```

The app is `beaam-drop` because `drop` is taken — Fly app names are globally
unique, not per-organisation.

## 8. Stripe, second half

Now the URL exists:

- Stripe → Developers → Webhooks → add endpoint
  `https://drop.beaam.app/api/stripe/webhook`, events
  `checkout.session.completed` and `checkout.session.expired`.
- `fly secrets set STRIPE_WEBHOOK_SECRET=whsec_… --app beaam-drop`.

No rebuild needed — it is a runtime value.

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

The delivery queue is swept every minute by an interval started in
`instrumentation.ts`. Fly has no cron trigger, and an in-process interval needs
no second machine and cannot drift out of step with the app it sweeps for.

Safe on every machine: `runFulfilment` claims each job with a guarded update on
`attempts`, so two instances sweeping at once means the loser skips, not a
duplicate send.

```bash
fly logs --app beaam-drop | grep fulfil
```

It only logs when it did something. A line a minute reading "0 0 0 0" buries
the one that matters.

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
