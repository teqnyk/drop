# Drop — build plan

**Date:** 21 August 2026
**Companion to:** [DROP-PRD.md](DROP-PRD.md) — the PRD says *what* and *why*;
this says *how, in what order, and how you know a phase is done.*

## Yes — the app comes first

Nothing else in the Drop programme can start before the application exists.
`~/Dev/drop` currently holds two documents and no code. Every downstream item —
the Beaam demo script, the marketing weaving, the Spanna phase, the combined
demonstration — needs a running storefront that can take a purchase and fail on
demand.

**Two exceptions, both real.** These need only the *fixture* (Maya Chen, Soft
Theory, Form/01, 38 of 100 sold) and can be written before a line of Drop code:

- Beaam's homepage notification mock, which already tells a Drop-shaped story
  about nobody.
- The `/demo` page rewrite, which closes the last open finding from the 20 August
  marketing audit.

Everything else waits.

## The ordering change worth making

PRD §21 sequences the build horizontally: all of the storefront, then all of the
purchase journey, then the dashboard, then observability. Followed literally,
**nothing is demonstrable until phase 4** — three phases of building with no way
to see whether the thing works as a demo.

This plan slices vertically instead. Phase 1 is a *walking skeleton*: an ugly
storefront that can take one test purchase and is connected to Beaam. It proves
the whole path end to end, and every phase after it deepens a part that already
works. The first time you see Beaam watching a real Drop purchase should be in
week one, not after the dashboard is finished.

That is not a criticism of §21 — a PRD lists scope, and scope groups naturally
by area. Build order is a different question.

---

## Phase 0 — decisions and accounts

Not code, but it blocks code, and some of it has lead time.

**Decide:**

- Repository shape: one app, or app plus a seed/ops package. Recommend one app
  until there is a reason.
- Framework: Next.js or Astro (PRD §14 allows either). Recommend **Next.js** —
  the demo needs server routes for checkout, webhooks and `/demo`, and Beaam's
  own OTel examples are Next-shaped.
- Hosting: Cloudflare Workers or Vercel. Either is a Beaam integration; pick the
  one you want on screen.
- Domain: a Teqnyk-owned subdomain (PRD §18).

**Provision** — these are the ones with waiting:

- MongoDB Atlas cluster (free tier is enough) + a read-scoped user for later
  Spanna use.
- Stripe account in **test mode**, with webhook signing secret.
- Supabase project for auth only.
- Resend domain — verification is DNS, so start it early.
- Sentry project.
- Cloudflare R2 bucket.
- A Beaam account and stack for `Drop production`.

**Done when:** every credential is in a `.env.example` with a real name, and a
`hello world` deploy is live on the chosen host and domain.

---

## Phase 1 — walking skeleton

**Goal:** one purchase, end to end, visible in Beaam. Ugly is fine.

- Product page for Form/01 rendering from MongoDB (not hardcoded).
- `Get the collection` → Stripe test checkout → signed webhook → order document.
- The guarded atomic decrement from PRD §14, and the unique index on
  `payment_reference`.
- A confirmation email through Resend with a download link.
- OpenTelemetry wired, exporting to Beaam. Connect Stripe, Supabase, Resend and
  MongoDB Atlas as Beaam integrations.

**Done when:** you buy Form/01 with a test card, receive the email, download the
file, and see the purchase as a trace in Beaam — and buying the 100th copy makes
the 101st attempt fail cleanly rather than going negative.

**And:** the onboarding notes exist, with a real minutes-to-first-signal number
and every friction point either filed against Beaam or explicitly judged
acceptable.

**Why first:** every architectural risk in the PRD lives in this path. If atomic
inventory, webhook idempotency or OTel export is going to be a problem, it is
better to find out now than after a dashboard is built on top.

**This phase is also a live test of Beaam's onboarding, and should be treated as
one.** Connecting Stripe, Supabase, Resend and MongoDB Atlas here is a real
customer walking the real path for the first time. Keep a running note while
doing it: what took longest, what needed a doc, what was ambiguous, what
silently did nothing. ADR-0001 claims setup should take a tired founder under
five minutes without documentation — this is the first honest measurement of
that claim, and it is worth more than the storefront it produces.

File what you find against Beaam the same day. Do not fix Beaam's onboarding
inside Drop by writing a workaround into the README; a README that explains
around a rough edge is how the rough edge survives.

---

## Phase 2 — the purchase journey, properly

Deepen what phase 1 proved.

- Reservations with the TTL index; expiry returns stock.
- Payment failure, delivery failure and inventory contention paths (PRD §9).
- Download entitlements: hashed tokens, expiry, re-download, resend.
- Fulfilment queue with bounded retries and visible permanent failure.
- `storefront_events` written on every meaningful action, **never blocking
  checkout**.

**Done when:** every journey in PRD §9 behaves as written, including the ones
that fail — and a failed email leaves a completed order with a working download
and an honest "not sent" state.

---

## Phase 3 — the creator dashboard

- Sales, revenue, remaining inventory, recent orders.
- Per-order payment / fulfilment / email state, with the provider's own error
  preserved.
- Release controls: publish, pause, mark sold out, resend delivery.

**Done when:** an incident is legible from the dashboard alone — you can see
*that* something is wrong and *which* orders it touched, without a database
client.

**Why here:** this is what gives an incident its business consequence on screen.
Before it, a demo can only show telemetry.

---

## Phase 4 — demo controls

The `/demo` control centre from PRD §10.

- Start with the four the MVP requires: slow checkout, payment failure, email
  failure, telemetry silence.
- Every scenario: visible active state, recorded actor, **ten-minute expiry**,
  immediate recovery, demo-tagged telemetry.
- **Restore healthy state** — disables everything and verifies a purchase.

**Done when:** you can break Drop and fix it from one page, a scenario left on
turns itself off, and the restore action proves the fix rather than asserting it.

**Do not skip the expiry.** The most common live-demo failure is a scenario
still running from the last rehearsal.

---

## Phase 5 — polish and the documentation package

- Visual identity properly applied (PRD §7) — this is the phase where Drop stops
  looking like a test app.
- Responsive, accessible, real empty/error/sold-out states.
- Seed script restoring the canonical Soft Theory release and a believable
  history.
- The three Beaam demo scripts, screenshots, architecture diagram.
- Adopt Drop across Beaam's marketing and docs (see
  [DROP-MARKETING-INTEGRATION.md](DROP-MARKETING-INTEGRATION.md)).

**Done when:** PRD §20's MVP list is fully satisfied and the §22 script can be
recorded start to finish without a retake for something broken.

---

## Later — not now

PRD §§23–25, in that document's phase numbering: Spanna adoption, then Notifire,
then the combined demonstration. Both marked *designed, not scheduled*. Nothing
in phases 0–5 may take a dependency on them.

The one thing phases 0–5 do for them: **the database is MongoDB Atlas from phase
1**, so `storefront_events` accumulates the whole time and Spanna's phase is a
vaulted connection and some documented questions rather than a migration.

---

## Sizing, honestly

I am not going to put day counts on this without knowing who is building it or
how much time they have. What is useful instead is where the risk sits:

| Phase | Relative size | Where it can go wrong |
|---|---|---|
| 0 | Small | DNS verification and Stripe webhook setup have real waiting |
| 1 | **Largest single step** | Every architectural risk lives here; resist making it pretty |
| 2 | Large | The failure paths are most of the work, and the easiest to fake |
| 3 | Medium | Mostly presentation over data that already exists |
| 4 | Medium | Expiry and restore are fiddlier than the scenarios themselves |
| 5 | Medium–large | Design polish expands to fill available time |

The two phases people underestimate are 2 and 4 — both are mostly about failure
behaviour, which is exactly what a monitoring demo needs and exactly what is
tempting to stub.

## Open decisions for Nick

1. **Framework and host** — Next.js on Cloudflare is my recommendation; say if
   you want Astro or Vercel instead.
2. **Who builds it.** This is a real application, not a fixture. If it is going
   to be built in sessions like this one, phase 1 is a session on its own.
3. **Public or private repo.** PRD §3 lists "a public example developers can
   inspect" as a secondary goal; that changes how the code is written, so it is
   worth deciding before phase 1 rather than after.
4. **Whether the two fixture-only marketing items go now** — they need no Drop
   code and close an open audit finding.
