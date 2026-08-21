# Weaving Drop into Beaam's marketing site

**Date:** 21 August 2026
**Companion to:** [DROP-PRD.md](DROP-PRD.md)

Drop's value to marketing is not "a demo page". It is that **one coherent
fictional product can replace fabricated data everywhere at once** — and the
20 August audit showed that fabricated, hand-maintained content is exactly where
this site goes wrong.

## The constraint that shapes everything

Drop is fictional. `/proof` exists specifically to refuse "invented logos,
testimonials or vanity counts", and its credibility is load-bearing.

**Drop may appear anywhere on the site except as evidence.** Illustration, yes —
screenshots, guides, the demo, diagrams. Proof, never. Nothing about Drop may
imply a customer, a usage number, or a verified production fact. Every Drop
surface carries a visible demo label, so a reader never has to work out whether
they are looking at a real account.

A drift test should assert the fixture names never appear on `/proof`, in the
same spirit as the tests added on 20 August.

## Where it goes, highest value first

### 1. `/demo` — the audit's one open finding

Finding 10 said the demo "is not a meaningful product demonstration": a synthetic
two-tab card, while the app is now stack-first with Now, Services, Integrations
and History. Drop is the fix, and this is the single highest-value placement
because it closes an open audit item rather than adding work.

Keep the existing synthetic alert explainer — it communicates the philosophy
well. Add beneath it the **Drop incident walkthrough**: the storefront, the
Beaam incident it produced, and the recovery. Static frames are enough to start;
the recorded 90-second cut replaces them when it exists.

### 2. The homepage notification mock

The hero already shows a phone notification reading *"payment-processor is down —
Stripe webhooks failing for 8 min. Likely cause: MongoDB replica lag."* That is
**already a Drop-shaped story told about nobody**. Make it literally Drop's, and
the same incident then recurs on `/demo`, in the guides and in the video —
repetition doing the work it should.

### 3. Guides — one worked example instead of five unrelated ones

The five guides currently each invent their own context. Rewriting them around
Drop gives a reader one architecture they learn once:

| Guide | Drop framing |
|---|---|
| `first-alert-in-five-minutes` | Connect Drop's storefront URL, get the first signal |
| `failures-that-return-200` | Checkout returns 200 while payments decline — Drop's canonical scenario |
| `monitor-stripe-payments` | Drop's actual payment path, with the failure demo |
| `monitor-supabase-project` | Drop's orders and inventory database |
| *(new)* `monitor-mongodb-atlas` | Drop's event store — and a natural bridge to Spanna |

`monitor-aws-lambda` stays as-is: AWS is withdrawn and already bannered.

### 4. Integration pages — a real screenshot each

Fourteen generated pages currently describe what Beaam watches without showing
it. Drop supplies one honest screenshot per provider, from the same seeded
state. This is also where the **numbers must agree**: 38 of 100 sold on every
page, on every site, or the shared fixture undoes itself in one glance.

### 5. `llms.txt` and the docs

A worked example an assistant can cite when asked "how would I monitor a small
storefront". Add a short Drop section naming the stack and linking the
walkthrough — assistants answer architecture questions far better with one
concrete example than with a provider list.

### 6. Comparison pages

`/compare/datadog` and `/compare/better-stack-uptimerobot` argue that uptime
checks miss real outages. Drop's canonical line is the argument, demonstrated:

> An uptime monitor would have said Drop was online. Beaam noticed customers
> could no longer buy.

### 7. A `/drop` page — later, not first

Worth having eventually as the thing other pages link to, and as the natural
host for the recorded walkthrough. Not the first move: a standalone page nobody
reaches adds a route without changing what anyone sees.

## What it does for the *other* two products

The same fixture on beaam.app, spanna.app and notifire.io is what makes three
tools read as one company. A reader who meets Maya on Beaam and again on Spanna
is being shown a stack, not a coincidence — and that is the Teqnyk brand
argument from `TEQNYK-BRAND.md` made in content rather than in a logo.

Concretely: the 3-minute cut of the unified script (PRD §25) is the only asset
where all three products appear, and it belongs on teqnyk.com as the answer to
"what is this company".

## Sequencing

1. **`/demo`** — closes an open audit finding.
2. **Homepage notification** — one string, immediate coherence.
3. **Guides** — the compounding SEO surface, and the biggest writing job.
4. **Integration screenshots** — needs the seeded environment to exist first.
5. **`llms.txt` + comparisons** — small, once the above exist.
6. **`/drop` + recorded video** — when there is something to record.

Steps 1–2 are copy changes available before Drop is built, using the fixture
alone. Steps 3–6 need the seeded environment.

## Drift risks this introduces

Drop is one more thing that can go stale, and this site's failure mode is
precisely stale duplication. Three guards worth adding with the content:

- Fixture facts (release name, price, edition size, sold count) live in **one**
  data file the pages read — never re-typed per page.
- A test asserting Drop's fixture never appears on `/proof`.
- Screenshots dated at capture, so an obviously old UI is visible as old rather
  than quietly wrong.
