# Adopting Drop across Beaam's demos, docs and tutorials

> Canonical plan for replacing Beaam's fabricated examples with one real,
> monitored application. Supersedes
> [`DROP-MARKETING-INTEGRATION.md`](DROP-MARKETING-INTEGRATION.md), which
> remains for its page-by-page detail on the marketing site.
>
> Written 2026-08-23.

## The argument in one paragraph

Beaam's public surfaces currently describe monitoring using data that was typed
rather than observed: `/demo` renders a fabricated incident, `proof.astro`
asserts behaviour, five guides each invent a different stack, and the
integration pages carry no screenshots at all. Every one of those is a claim a
reader has to take on trust — from a one-person company with no SOC 2 and no
logos. Drop replaces the fabrication with a working application that can be
broken on command and watched recovering. The same incident then produces the
demo, the screenshots, the guide, the comparison and the video, and they all
agree with each other because they came from one run of one system.

This is a credibility strategy, not a content strategy. The reason to do it is
that **"here is our monitoring tool watching our own real app fail" is an
argument a competitor with a bigger marketing budget cannot copy cheaply.**

---

## Phase 0 — the gate (nothing below is honest until this is done)

Drop is built and passes 97 tests, but **it has never run against a real
provider**. `.env.local` is empty; nothing is deployed. Every asset below is
blocked on this, and producing any of them from local fixtures would recreate
exactly the fabrication problem this plan exists to solve.

1. **Credentials.** Stripe test keys, Resend key + verified domain, a Supabase
   project with one creator user, MongoDB Atlas, a Cloudflare account for the
   Worker and R2 bucket, a Sentry project.
2. **Deploy.** `pnpm asset:push` then `pnpm run deploy`, on a real domain
   (`drop.beaam.app` or similar — it must not look like localhost in a
   screenshot).
3. **Connect to Beaam, as a new user would.** This is the end-to-end onboarding
   test the build plan calls for: sign up, connect MongoDB / Stripe / Resend /
   Sentry / Cloudflare, apply a monitoring plan, confirm alerts arrive.
   **Record every point of friction.** This run is worth more as product
   feedback than as marketing material.
4. **Seed and verify.** `pnpm seed`, then confirm the storefront, dashboard and
   `/demo` all read correctly against production.

**Done when:** an incident triggered from Drop's `/demo` produces a real Beaam
alert on a real phone, and the whole path is repeatable.

**Estimate:** 1–2 days, most of it waiting on DNS and provider verification.

---

## Phase 1 — the incident catalogue

Everything downstream is generated from a small set of *scripted incidents*.
Build the catalogue once; harvest it many times.

Drop already ships five scenarios (`lib/types.ts` → `SCENARIO_TYPES`). Each
maps to an asset set:

| Scenario | The story it tells | Feeds |
|---|---|---|
| `payment_failure` | Storefront healthy, revenue stops | `/demo`, homepage, Stripe guide, comparison pages |
| `email_failure` | Order completes, confirmation never arrives | Resend integration page, "failures that return 200" guide |
| `telemetry_silence` | Traffic continues, visibility stops | The watchdog story, "don't go silent" promise |
| `frontend_exception` | Server clean, browser broken | Sentry integration page |
| `slow_checkout` | Nothing fails, everything degrades | Latency/threshold docs |

For each, capture **one run** producing: the Beaam incident page, the alert as
delivered (email + push), the correlation panel, Drop's own dashboard showing
business impact, and the recovery.

**The rule that makes this work:** all five run against the *same* seeded state
(`pnpm db:reset`), so a reader moving between assets sees one coherent shop —
Form/01 at 62 of 100 — rather than five unrelated screenshots.

**Estimate:** 1 day for all five, once Phase 0 is done.

---

## Phase 2 — demos

### 2a. Replace `/demo` (highest value single change)

`beaam-marketing/src/pages/demo.astro` today is hand-written HTML describing an
invented "checkout is returning errors" incident. Replace its content with the
**real** payment-failure incident from Phase 1 — same layout, real screenshots,
real timestamps, real correlation text — and say plainly underneath that it
came from a live application whose source is public.

The interactive shell stays. What changes is that every string in it is now
something that happened.

### 2b. The five-minute live demo

A written script (`docs/demos/five-minute.md` in this repo) a human can follow
without improvising: open Drop, buy something, break payments from `/demo`,
watch the alert arrive, show the correlation, restore. Timings per step.
Rehearsed against the real deployment.

### 2c. The recorded walkthrough

The marketing audit's finding 10, still open: a 60–90 second product
walkthrough. It has been blocked on having something real to show. It is not
any more.

### 2d. Self-serve sandbox — later, and only if asked for

A read-only Beaam account showing Drop's live stack, linked from the site.
Genuinely compelling, but it needs auth work and a story for abuse. Do not put
it before the recorded walkthrough.

---

## Phase 3 — docs

| Doc | Today | With Drop |
|---|---|---|
| `docs/quickstart-otel.md` | Generic curl example | The exact exporter Drop ships (`lib/telemetry.ts`), which is known to work because it feeds production |
| `beaam-marketing/.../docs/opentelemetry.md` | Hand-written payload | Payload copied from a real request, verified against `isOtlpMetricsShape` |
| `docs/api.astro`, `docs/mcp.astro` | Abstract | Worked example: connect Drop's MongoDB via MCP, from the same transcript the CLI docs use |
| `integrations/[slug].astro` | No screenshots | One real screenshot per provider, from Drop's own connection |
| `/llms.txt` | Text only | Add Drop as the worked reference, with its public repo — an assistant answering "how do I monitor a Next.js app" can then cite running code |

The integration screenshots matter more than they sound: they are the only
place a reader sees what Beaam actually looks like watching *their* provider,
and there are currently none.

---

## Phase 4 — tutorials and guides

Today's five guides each invent a different stack (Lambda, Stripe, Supabase,
HTTP 200s, first alert). They are good writing about unrelated situations.

**Restructure as one continuous worked example plus specifics.** A reader
follows Drop from "here is a real app" through connecting each provider to
seeing a real incident. Each existing guide becomes a chapter that references
the same shop, rather than a self-contained fiction.

Two new pieces:

- **"Monitor a real Next.js app in 10 minutes"** — the flagship tutorial, using
  Drop's public repo. A reader can clone it and follow along with their *own*
  Beaam account. This is the piece most likely to be linked from elsewhere.
- **"What we found monitoring our own demo app"** — a blog post written from
  the Phase 0 onboarding notes. Honest friction included; that is what makes it
  readable, and it doubles as the changelog for what got fixed.

**Estimate:** the restructure is 2–3 days of writing. Do it after the demos —
the assets from Phase 1 are what the guides embed.

---

## Phase 5 — proof, comparisons and trust

- **`proof.astro`** stops asserting and starts showing: a dated incident with
  its alert, its correlation, and its recovery. Link the commit that caused it.
- **`compare/datadog.astro`** and the Better Stack page gain a section running
  the *same* Drop incident through both products. Fair, specific, and the
  strongest version of a comparison page: it cannot be accused of a strawman
  when the reader can reproduce it.
- **Status and security pages** gain a line: the monitoring described here is
  what watches Drop, publicly, at a URL.

---

## Phase 6 — the machinery that keeps it true

The marketing audit found nine of ten problems were one problem: **a fact the
codebase owns, re-typed into prose, then drifting.** Basing everything on Drop
multiplies the surface for exactly that. So build the guards with the content,
not after it:

1. **Scripted capture.** A script that resets Drop to canonical state, runs a
   scenario, waits, and captures each screenshot to a known path. Screenshots
   become regenerable rather than archaeological.
2. **One clock, one state.** Every asset from `pnpm db:reset` + a named
   scenario. Documented in `docs/demos/`.
3. **Drift tests.** Extend `beaam-app/tests/marketing-drift.test.ts`: if a page
   quotes Drop's numbers (38 sold, 100 edition, seven releases), assert them
   against `lib/fixture.ts` through the published catalogue, not by hand.
4. **An ops runbook** — `docs/ops/drop-demo-environment.md` in the Beaam repo:
   how to reset it, what breaks, who to call when the demo is down twenty
   minutes before a call.
5. **A recurring check.** Drop is now a production dependency of the marketing
   site's credibility. If Drop is down, `/demo` is a lie. Beaam should monitor
   Drop, and someone should be paged.

---

## Sequencing

```
Phase 0  deploy + connect + onboarding E2E        ← blocks everything
   │
Phase 1  incident catalogue (5 scenarios)
   │
   ├── Phase 2a  /demo replacement                 ← ship first, highest value
   ├── Phase 2b  five-minute script
   ├── Phase 3   integration screenshots + OTel docs
   │
Phase 2c  recorded walkthrough
Phase 4   guide restructure + flagship tutorial
Phase 5   proof + comparisons
   │
Phase 6   capture scripts, drift tests, runbook    ← alongside, not after
```

**If only one thing gets done:** Phase 0 plus Phase 2a. A real `/demo` closes
the audit's oldest finding and is the page most likely to convert.

---

## What this is not

- **Not a reason to delay launch.** Beaam is live. This improves conversion and
  credibility; it does not gate signups.
- **Not a product.** Drop stays a demonstration. The moment it grows features
  for its own sake, it stops being cheap to keep honest.
- **Not a licence to fabricate faster.** If a scenario will not reproduce, the
  asset does not get made. That is the whole point of building the app.
- **Not Spanna or Notifire yet.** PRD §§23–25 design the combined demonstration;
  it stays a later phase. Beaam first.

## Risks worth naming

| Risk | Mitigation |
|---|---|
| Drop breaks and `/demo` becomes false | Beaam monitors Drop; alert on it |
| Screenshots age as Beaam's UI changes | Scripted capture makes regeneration cheap |
| Drop's fictional data read as a real customer | The demo banner is load-bearing (PRD §26) and appears in every screenshot |
| Effort sink — polishing Drop instead of shipping Beaam | Phases 1–2 only; stop when the assets exist |
| Stripe test-mode keys leak into a screenshot | Drop refuses any key not starting `sk_test_` |
