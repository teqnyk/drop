# Drop

A storefront for creators selling limited digital releases — and a
**demonstration application**. Drop exists to show what
[Beaam](https://beaam.app) monitors, using a product realistic enough that the
failures mean something.

> **Drop is fictional.** Maya Chen, Soft Theory and Form/01 do not exist, and
> nothing here is for sale. It illustrates; it is never evidence. See
> [`DROP-PRD.md`](DROP-PRD.md) §26.

## Status

**Phases 0–4 built and verified locally.** The purchase path works end to end,
the demo control centre breaks and restores it, and Beaam's own parser accepts
the telemetry.

| | |
|---|---|
| Storefront | Renders Form/01 from MongoDB, with sold-out, paused and unseeded states |
| Checkout | Reserves atomically, then creates a Stripe session — in that order |
| Webhook | Signature-verified; the only thing that creates an order |
| Orders | Idempotent by unique index, so replays cannot double-sell |
| Downloads | Hashed entitlement tokens, streamed from a private R2 bucket |
| Dashboard | Sales, revenue, inventory, and *why* a delivery failed |
| Delivery | Bounded retries that give up visibly, and a creator resend |
| Release controls | Pause, resume, mark sold out — behind creator sign-in |
| `/demo` | Four scenarios, each self-expiring, plus a restore that verifies |
| Telemetry | OTLP/JSON to Beaam, validated against Beaam's own parser |

**Not done:** Sentry, and the seeded history depth. See
[`DROP-BUILD-PLAN.md`](DROP-BUILD-PLAN.md).

Nothing has been deployed — that needs Cloudflare credentials and a domain.

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 16 on Cloudflare Workers (OpenNext) | Server routes for checkout, webhooks and `/demo`; matches Beaam's own runtime |
| Database | MongoDB Atlas | Everything: releases, inventory, orders, entitlements, events. One store, monitored natively by Beaam, and the one Spanna reads later |
| Auth | Supabase | Identity only — application data is not in Postgres |
| Payments | Stripe, **test mode always** | |
| Email | Resend | |
| Files | Cloudflare R2 | Private bucket, binding not access keys |
| Errors | Sentry | |
| Telemetry | OpenTelemetry → Beaam | The point of the whole thing |

## Running it

```bash
pnpm install
cp .env.example .env.local   # works as-is for the storefront; fill in the rest

pnpm db:start                # MongoDB on 27077 — leave running in its own terminal
pnpm db:reset                # seed Form/01 back to 38 of 100
pnpm dev                     # http://localhost:3020
```

`pnpm db:start` runs in the foreground and keeps its data in `.localdb/`, so it
survives a reboot. `pnpm db:reset` restores the canonical release whenever a demo
run leaves it somewhere odd.

### The creator dashboard

`/dashboard` lists buyers' email addresses and can pause the release, so it is
behind Supabase Auth plus an allowlist. Create **one** user by hand in the
Supabase dashboard (Authentication → Users) and set three variables:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DROP_CREATOR_EMAILS=you@example.com
```

There is no sign-up page. A Supabase project accepts public signups by default,
so "has a session" is not "is the creator" — the allowlist is the second half
of the check, and it is enforced on the server actions, not only on the page.

Leave all three unset and the dashboard stays open **in local development
only**, with a banner saying so. A production build refuses instead: a
deployment that forgets its environment variables gets a locked door rather
than an open control panel.

The storefront, demo controls and telemetry all work without any of this.

### The product file

The download is a real zip streamed from a **private** R2 bucket. There is no
public URL and no signed link with a guessable key — the hashed entitlement
token is the only way to a byte of it.

```bash
pnpm asset:seed     # build the zip, put it in the LOCAL bucket
pnpm asset:push     # the same, against the real bucket
```

R2 is reached through the `PRODUCT_FILES` binding in `wrangler.jsonc`, which
`next dev` also provides, so there are no access keys and local development
runs the same code path as the deploy.

The zip is built by hand rather than shelled out to `zip`, so it is
byte-identical on every run: `zip` stamps the current time into each entry,
which would make re-seeding upload a "new" file every time.

If the object is missing, a valid entitlement gets an **error**, not a 200 with
an empty body. A zero-byte file the browser saves as `form-01.zip` is the worst
outcome available — the customer thinks they have the product, the dashboard
thinks it was delivered, and nobody finds out until someone tries to open it.
The dashboard warns about a live release with no file for the same reason.

### The fulfilment sweep

`/api/cron/fulfil` works the delivery queue and is guarded by
`DROP_CRON_SECRET`, because retries are finite — each call spends an attempt
against every due job, so an open endpoint would let anyone drive pending
deliveries to `exhausted` in four requests. Unset, it answers 404.

```bash
curl -H "Authorization: Bearer $DROP_CRON_SECRET" http://localhost:3020/api/cron/fulfil
```
**Checkout needs a Stripe test key** — without one the buy button returns an
error rather than silently pretending, which is the behaviour everywhere in this
codebase.

`pnpm` is pinned to 9.15.9. Corepack otherwise pulls pnpm 11, which errors on
unapproved build scripts and writes a broken workspace file — the same footgun
recorded in Beaam's own AGENTS.md.

Nothing has a default. A missing credential fails loudly, because a demo that
silently runs on a fallback misrepresents the stack it is demonstrating.

## Two things to know before contributing

**The demo banner is not decoration.** Drop is fictional, and every surface says
so. It must not be removed to make a screenshot look cleaner.

**Failure behaviour is the product.** Drop's value is what it does when payments
decline, email bounces, or a worker stops. A stubbed failure path is a missing
feature, not a shortcut — it is the half a monitoring demo actually needs.

## Licence

[MIT](LICENSE) © 2026 Teqnyk Ltd.

The demonstration *fixtures* are not covered by that in spirit: Maya Chen, Soft
Theory and Form/01 are Teqnyk's demonstration identity, and reusing the code is
welcome in a way that reusing the persona to imply a Teqnyk endorsement is not.
