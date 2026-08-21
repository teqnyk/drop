# Drop

A storefront for creators selling limited digital releases — and a
**demonstration application**. Drop exists to show what
[Beaam](https://beaam.app) monitors, using a product realistic enough that the
failures mean something.

> **Drop is fictional.** Maya Chen, Soft Theory and Form/01 do not exist, and
> nothing here is for sale. It illustrates; it is never evidence. See
> [`DROP-PRD.md`](DROP-PRD.md) §26.

## Status

**Phase 0 — scaffold.** A deployable Next.js shell, the credential manifest, and
the identity. No database, checkout or telemetry yet.

See [`DROP-BUILD-PLAN.md`](DROP-BUILD-PLAN.md) for what each phase adds and how
you know it is done.

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 16 on Cloudflare Workers (OpenNext) | Server routes for checkout, webhooks and `/demo`; matches Beaam's own runtime |
| Database | MongoDB Atlas | Everything: releases, inventory, orders, entitlements, events. One store, monitored natively by Beaam, and the one Spanna reads later |
| Auth | Supabase | Identity only — application data is not in Postgres |
| Payments | Stripe, **test mode always** | |
| Email | Resend | |
| Files | Cloudflare R2 | |
| Errors | Sentry | |
| Telemetry | OpenTelemetry → Beaam | The point of the whole thing |

## Running it

```bash
pnpm install
cp .env.example .env.local   # then fill it in
pnpm dev                     # http://localhost:3020
```

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

Not yet chosen. Decide before the first external contribution.
