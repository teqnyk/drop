# Drop — Product requirements document

> **Status:** Draft  
> **Product type:** Demonstration application  
> **Primary purpose:** A realistic sample application for **Beaam, Notifire and
> Spanna** documentation, screenshots, demonstrations, videos, and testing  
> **Working tagline:** *Small releases. Big launch energy.*  
> **Revision:** 21 August 2026 — extended from a Beaam-only fixture to the
> shared Teqnyk demonstration application. Beaam sections are unchanged in
> substance; §14 (architecture) and §15 (data model) were revised in place
> rather than contradicted, and Parts II–III are new.

## 1. Product summary

Drop is a lightweight storefront for creators selling limited digital-product
releases such as icon packs, website templates, fonts, ebooks, or presets. Each
release has a fixed quantity or closing time. Customers visit the storefront,
complete checkout, and receive the product by email.

Drop should look and behave like a credible product built and operated by a solo
founder. Behind its simple storefront, it uses services commonly found in an
independent SaaS stack: hosting, serverless compute, database, payments, email,
storage, scheduled jobs, and error tracking.

Its main purpose is to demonstrate how Beaam monitors an entire product, detects
failures, connects symptoms across providers, and tells a founder when something
genuinely requires attention.

Drop is also the demonstration application for **Notifire** and **Spanna**. That
is not three demos wearing one costume: Drop is an indie SaaS, indie stacks are
heterogeneous, and each product answers a different question a solo creator
actually has on launch day.

| Product | Drop's question | What Drop demonstrates |
|---|---|---|
| **Beaam** | "Is anything broken, and does it matter?" | Detection and correlation across every provider in the stack |
| **Notifire** | "Did the customer actually get their download?" | Notification fan-out, persistence, retry and delivery truth |
| **Spanna** | "Why did 200 people look and 38 buy?" | Reading the event store to answer a business question |

The three interlock in a single narrative, which is the point: checkout starts
failing, **Beaam** detects it, the alert reaches Maya, she opens **Spanna** to
see how many customers hit the failure, and **Notifire** shows the confirmation
emails that queued rather than vanished. One incident, three products, no
contrivance.

## 2. Product vision

Drop should make Beaam demonstrations feel like stories rather than technical
walkthroughs.

A typical story begins with a creator launching a new product. Customers arrive
and sales start appearing. A controlled failure is introduced—payments decline,
checkout slows down, or delivery emails stop. Beaam identifies the problem,
alerts the founder, and confirms recovery.

Drop should be:

- Understandable within ten seconds.
- Visually distinctive enough for polished videos and screenshots.
- Technically realistic without being unnecessarily complex.
- Safe and inexpensive to operate.
- Easy to reset into a known demonstration state.
- Instrumented across every important customer journey.
- Capable of producing believable, controlled incidents.

## 3. Goals

### Primary goals

- Provide one consistent fictional product across Beaam's documentation.
- Demonstrate monitoring across multiple integrations.
- Show the business impact of technical failures.
- Produce repeatable incident and recovery scenarios.
- Support live demonstrations without manual database preparation.
- Generate attractive screenshots, videos, and diagrams.
- Act as a reference implementation for connecting an application to Beaam.
- Exercise Beaam's detection, correlation, notification, and recovery flows.
- Act as the reference implementation for sending an application's own
  notifications through Notifire, including the failure and retry paths.
- Provide a realistic MongoDB event store that Spanna can be demonstrated
  against, with questions worth asking rather than a toy collection.

### Secondary goals

- Serve as a realistic test workload for Beaam.
- Demonstrate OpenTelemetry instrumentation.
- Provide sample integration code and configuration.
- Help prospective users understand what Beaam can monitor.
- Create a public example that developers can inspect or reproduce.
- Potentially become an open-source starter application.

## 4. Non-goals

The initial release will not:

- Become a general-purpose ecommerce platform.
- Support physical product fulfilment.
- Support multiple sellers in one account.
- Provide tax calculation or complex invoicing.
- Manage subscriptions or operate as a marketplace.
- Include reviews, social features, or advanced storefront customisation.
- Support multiple currencies.
- Store payment-card information.
- Compete with Gumroad, Lemon Squeezy, or Shopify.
- Require a production-grade creator acquisition strategy.

Product decisions should favour demonstration quality and operational clarity
over commercial completeness.

## 5. Target users

### Independent creator

A designer, developer, writer, or photographer releasing a small digital
product. They work alone or with one collaborator, expect traffic in short
bursts, care about successful payment and delivery, and do not want to watch
infrastructure dashboards.

> Maya is an independent designer releasing 100 copies of an interface icon
> collection. She promotes the release to her audience and wants to keep
> designing rather than refreshing Stripe, email, and hosting dashboards.

### Customer

A person purchasing a digital product. They expect a fast, trustworthy
storefront, clear availability and pricing, reliable checkout, immediate
confirmation, and a working download link.

### Beaam presenter

The person demonstrating Beaam needs a predictable application state, safe
failure controls, visible customer impact, rapid incident generation, automatic
recovery, and realistic telemetry without unpredictable costs.

## 6. Canonical product fixture

The canonical Drop storefront is operated by fictional creator **Maya Chen**
under the studio name **Soft Theory**.

### Form/01 — Interface Icon Collection

- Carefully drawn interface icons for independent software products.
- Price: $29.
- Edition: 100 copies.
- Release status: live.
- Format: SVG and Figma library.
- Licence: personal and commercial use.
- Delivery: email and post-checkout download.
- Visual style: monochrome product imagery with a vivid coral accent.

These details should remain consistent across documentation unless a scenario
specifically requires a variation.

## 7. Brand direction

Drop should contrast with Beaam while looking credible beside it. Its
personality is expressive, energetic, creative, independent, and modern.

The visual direction uses a warm off-white background, near-black typography,
a coral or vivid orange accent, large editorial imagery, generous spacing,
visible inventory, and subtle checkout motion. It should feel like an
independent design studio's storefront rather than a generic SaaS dashboard.

Beaam remains calm, structured, and operational. This contrast makes the move
from customer-facing product to monitoring interface effective in demos.

## 8. Product scope

### Customer-facing storefront

The public storefront includes:

- Creator or studio identity.
- Product name, description, imagery, price, and contents.
- Remaining edition count and optional closing time.
- Licence, delivery, and trust information.
- Purchase call to action and sold-out state.
- Checkout, purchase confirmation, and secure download flows.

### Creator dashboard

The authenticated dashboard includes release status, sales, gross revenue,
remaining inventory, recent orders, payment and delivery status, a basic
conversion summary, release controls, and a storefront link.

It is intentionally small and exists primarily to show the business impact of
an incident.

### Release management

The creator can create a draft, set its content and commercial details, upload
imagery and a product file, set quantity or closing limits, publish or pause the
release, mark it sold out, and resend an order's delivery email. The canonical
demo release may initially be seeded rather than created through the interface.

### Checkout

Checkout must:

1. Reserve one unit of inventory.
2. Create a payment session.
3. Send the customer to the payment provider.
4. Verify payment with a signed webhook.
5. Convert the reservation into a completed order.
6. Generate a secure download entitlement.
7. Send a confirmation email.
8. Display the confirmation page.

A browser redirect must never be treated as proof of payment.

### Digital delivery

After successful payment, the customer receives a confirmation email and can
download from the confirmation page. Download URLs are time-limited or
token-protected, failures are observable, and the creator can resend delivery.
The product file must not be publicly enumerable.

## 9. Principal user journeys

### Successful purchase

1. The customer visits the product page.
2. Drop records a storefront view.
3. The customer selects **Get the collection**.
4. Drop creates a temporary inventory reservation.
5. The customer completes payment.
6. A payment webhook confirms success.
7. Drop creates the order and reduces inventory.
8. Drop creates a download entitlement and sends confirmation.
9. The customer downloads the product.
10. The creator dashboard updates.

### Payment failure

The reservation is released, the customer receives a clear retry message, and
no completed order is created. Drop records the cause; Beaam detects an elevated
failure rate when the threshold is crossed.

### Delivery failure

The completed order and post-checkout download remain available, but the
creator dashboard marks email delivery as failed and preserves the underlying
provider error for retry. A failed email must never look successful.

### Inventory contention

When several customers attempt to purchase the final copy, inventory is
reserved atomically. Only one receives the final reservation, inventory never
becomes negative, and nobody is charged without receiving an entitlement.

### Recovery

When a failing component returns to normal, successful traffic resumes and
Beaam observes enough healthy evidence to resolve the incident and notify the
creator. The incident remains available in history.

## 10. Demonstration control centre

Drop must provide a protected control centre at `/demo`. It is never linked
from the storefront and requires an administrator session, a dedicated demo
secret, or a development environment. It is disabled by default in unrelated
production deployments.

### Controlled scenarios

- **Slow checkout:** Add configurable latency, defaulting to four seconds.
- **Payment failures:** Reject a configurable percentage of attempts, default
  60%, without creating completed orders.
- **Database write failures:** Reject order writes while preserving payment
  reconciliation information.
- **Email failures:** Reject confirmation dispatch while keeping the order and
  download available.
- **Storage failures:** Allow purchase but fail download generation or retrieval
  with a useful error and retry path.
- **Worker stopped:** Pause fulfilment processing, retain queued events, and
  produce queue-depth and stale-worker signals.
- **Frontend exception:** Trigger a controlled checkout exception and report it
  to error tracking.
- **Telemetry silence:** Stop selected telemetry while continuing to serve
  traffic, allowing Beaam to detect lost visibility.
- **Full outage:** Return an unhealthy response and optionally make the
  storefront unavailable while keeping demo recovery reachable where practical.
- **Notification provider failure:** Fail the transport *behind* Notifire while
  Drop keeps publishing successfully. Messages must persist and retry rather
  than vanish — this is the Notifire demonstration, and it is a different
  failure from "email failures" above, which fails Drop's own dispatch.
- **Event-store lag:** Delay or fail writes to MongoDB Atlas while the purchase
  path stays healthy. Shows Beaam catching a degraded dependency that has no
  customer-visible symptom yet, and gives Spanna a visible gap in the funnel.

### Safety requirements

Every scenario must show its active state, record who enabled it and when,
expire after ten minutes by default, support immediate recovery, avoid permanent
data corruption, tag demonstration telemetry, and prevent incompatible
scenarios where needed.

A global **Restore healthy state** action disables every scenario and verifies
the principal customer journey.

## 11. Canonical Beaam demonstrations

### Launch-day checkout slowdown

Traffic increases and checkout slows. Beaam shows latency, the affected service,
the start time, relevant deployment or configuration events, customer impact,
and recovery.

### Payment-provider failure

The storefront remains online but customers cannot buy. Beaam identifies
elevated payment failures and the payment integration as the likely source.
This demonstrates why a simple uptime check is insufficient.

### Confirmation emails stop

Payments and downloads continue, but confirmation dispatch fails. Beaam reports
partial degradation and identifies the email integration requiring attention.

### Silent background worker

Checkout works while fulfilment events accumulate. Beaam shows increasing queue
depth, a stale heartbeat, delayed delivery, and recovery as the queue drains.

### Monitoring goes silent

Drop appears operational but Beaam loses telemetry from one component. Beaam
distinguishes **healthy** from **not currently observable** and reports the last
successful telemetry time.

### Faulty deployment

A new deployment causes checkout exceptions. Beaam correlates the recent change
with the error increase without presenting correlation as proven causation, then
confirms recovery after rollback.

## 12. Functional requirements

### Storefront

- Responsive on mobile and desktop.
- Public product details without authentication.
- Current availability and disabled checkout while paused or sold out.
- Accessible imagery, keyboard navigation, and explicit loading, empty, error,
  and sold-out states.

### Orders

Each order records its release, customer email, payment-provider reference,
payment and fulfilment states, email status, amount and currency, reservation
and completion timestamps, download entitlement, demo marker, and bounded
failure diagnostics.

### Inventory

Reservations are atomic and expiring. Expired reservations return stock,
successful orders consume exactly one unit, webhook reconciliation is
idempotent, duplicate webhooks cannot create duplicate orders, and inventory
cannot become negative.

### Email

Confirmation includes product and download details. Provider identifiers are
recorded; dispatch acceptance is not described as confirmed delivery. Failed
dispatch remains visible and retries are bounded and observable. Demo mode may
route messages to a safe sink.

### Downloads

Downloads require an unguessable entitlement. Attempts are observable, expired
links have a recovery path, provider failures produce useful errors, and a
failed download cannot invalidate the purchase.

## 13. Observability requirements

Drop must produce distributed traces, metrics, structured logs, application
errors, business events, deployment/configuration events where available,
worker heartbeats, and queue measurements.

### Required measurements

- Storefront availability and response time.
- Checkout request rate, latency, and error rate.
- Payment attempts, successes, and failures.
- Order creation successes and failures.
- Confirmation dispatch successes and failures.
- Download successes and failures.
- Active reservations and remaining inventory.
- Queue depth and oldest queued-event age.
- Worker last-success time.
- Database operation latency.
- Telemetry last-received time.
- Notification publish successes and failures (Drop → Notifire).
- Notification delivery state as Notifire reports it, and the age of the oldest
  undelivered message.
- Event-store write successes, failures and lag (Drop → MongoDB Atlas).

### Logical services

- `drop-storefront`
- `drop-checkout`
- `drop-orders`
- `drop-fulfilment`
- `drop-notifications`

All services share a stack identifier such as `drop-production`.

### Purchase trace

A successful purchase should be traceable through storefront checkout,
inventory reservation, payment-session creation, webhook handling, order
creation, fulfilment, email dispatch, and entitlement creation. Sensitive
customer and payment information must not appear in telemetry.

### Health signals

Drop provides process liveness, dependency readiness, a safe non-billable
synthetic purchase journey, and a worker heartbeat. A shallow HTTP `200` must
not be treated as proof that checkout and fulfilment work.

## 14. Suggested architecture

The reference implementation should favour services supported by Beaam, and use
Teqnyk's own products where Drop genuinely needs what they do:

- Frontend: Next.js or Astro.
- Hosting: Cloudflare Workers/Pages or Vercel.
- **Transactional database and authentication: Supabase (Postgres).** Orders,
  inventory and reservations live here because they need atomicity — §12
  requires that inventory can never go negative and that a duplicate webhook
  cannot create a duplicate order. That is a transactional guarantee, not a
  preference.
- **Event and analytics store: MongoDB Atlas.** Storefront views, funnel steps,
  and per-release engagement are append-only documents with a shifting shape.
  This is the collection **Spanna** is demonstrated against, and Beaam already
  monitors MongoDB Atlas natively, so it costs no monitoring coverage.
- Payments: Stripe.
- **Notifications: Notifire.** Drop does not call Resend directly. Every
  customer and creator message — order confirmation, download link, delivery
  retry, sold-out notice, launch-day summary — is published to Notifire, which
  owns fan-out, persistence, retry and delivery state. Resend remains the
  underlying email transport *behind* Notifire, so Beaam's Resend integration
  still has something to watch.
- Object storage: Cloudflare R2 or Supabase Storage.
- Error tracking: Sentry.
- Telemetry: OpenTelemetry sent to Beaam.
- Monitoring and alerting: Beaam.

**Two databases is a deliberate choice, and the PRD should defend it rather than
hide it.** A single Postgres would be the simpler build. It would also make
Spanna undemonstrable and misrepresent the stacks Drop is modelled on, where a
transactional store and a document event store commonly coexist. If the split
ever feels contrived in a demo, that is a signal the *event* data is too thin —
add engagement detail, not a second orders table.

```text
Customer
   ↓
Drop storefront ──────────────► Event store (MongoDB Atlas)
   ↓                                    ↑        │
Checkout API                            │        └──► Spanna
   ├── Inventory and orders (Postgres) ─┘             (Maya reads the funnel)
   ├── Payment provider (Stripe)
   ├── Fulfilment queue
   └── Object storage (R2)
             ↓
       Notifire  ──► email · push · webhook
       (fan-out, persistence, retry, delivery state)

All application services
   ↓
OpenTelemetry + provider signals
   ↓
Beaam
   ↓
Founder notification
```

The system may be a small monolith with background handlers. Logical services
do not require separate repositories or deployments.

## 15. Data model

### Creator

`id`, `name`, `studio_name`, `email`, `created_at`

### Release

`id`, `creator_id`, `slug`, `title`, `description`, `price_amount`, `currency`,
`quantity_total`, `quantity_remaining`, `closes_at`, `status`,
`product_asset_id`, `published_at`, `created_at`

### Reservation

`id`, `release_id`, `customer_email`, `expires_at`, `status`, `created_at`

### Order

`id`, `release_id`, `reservation_id`, `customer_email`, `payment_reference`,
`payment_status`, `fulfilment_status`, `email_status`, `amount`, `currency`,
`is_demo`, `created_at`, `completed_at`

### Download entitlement

`id`, `order_id`, `token_hash`, `expires_at`, `download_count`,
`last_downloaded_at`, `created_at`

### Fulfilment event

`id`, `order_id`, `event_type`, `status`, `attempt_count`, `last_error`,
`next_attempt_at`, `created_at`, `completed_at`

### Demo scenario

`id`, `scenario_type`, `configuration`, `enabled_by`, `enabled_at`, `expires_at`,
`disabled_at`

### Notification dispatch (Postgres)

Drop records what it *asked Notifire to send*, not what Notifire did with it —
delivery state is Notifire's to own, and duplicating it here would create two
answers to one question.

`id`, `order_id`, `notifire_event_id`, `event_type`, `published_at`,
`last_known_state`, `state_checked_at`

### Event store — MongoDB Atlas (`drop_events`)

Append-only, flexible shape, and the collection Spanna is demonstrated against.
Not a second source of truth for orders: nothing here may contradict Postgres,
and nothing in the purchase path may block on a write to it.

**`storefront_events`** — one document per meaningful customer action:

```json
{
  "_id": "…",
  "release_slug": "form-01",
  "type": "view | checkout_started | payment_failed | purchase_completed | download",
  "occurred_at": "2026-08-21T09:14:02Z",
  "session_id": "…",
  "referrer": "twitter | newsletter | direct | …",
  "device": { "kind": "mobile", "viewport": "390x844" },
  "checkout": { "latency_ms": 4180, "failure_reason": "card_declined" },
  "is_demo": true
}
```

**`release_rollups`** — a per-release daily document Spanna can chart, and the
thing that makes "views vs sales" a one-query answer rather than an aggregation
lesson.

Every document carries `is_demo` so demonstration traffic can be isolated and
deleted (§16), and no document carries a customer email, payment reference or
download token.

## 16. Security and privacy

Drop must use provider-owned payment handling, never store card details, verify
webhook signatures, process webhooks idempotently, protect creator/demo routes,
keep assets private, store entitlement tokens as hashes where practical, avoid
emails in URLs, exclude sensitive values from telemetry, rate-limit checkout
and downloads, validate redirects and server-side destinations, use
least-privilege credentials, isolate demo data, and support automatic demo-data
deletion.

## 17. Reliability requirements

- A failed dependency must not produce a valid-looking success.
- Partial fulfilment remains visible and retryable.
- Payment success survives downstream email or storage failures.
- Background retries are bounded; permanent failures become visible.
- Demo controls use normal observability paths.
- Global reset restores and verifies a healthy baseline.
- The application remains inexpensive while idle.
- A scheduled check verifies the canonical purchase journey.

## 18. Documentation fixtures

Drop should provide reusable healthy, incident, and recovery screenshots;
integration and OpenTelemetry examples; public status examples; alert messages;
architecture diagrams; walkthroughs; incident tutorials; and API/MCP examples.

Canonical names:

- Product: Drop.
- Creator studio: Soft Theory.
- Creator: Maya Chen.
- Release: Form/01 — Interface Icon Collection.
- Production stack: Drop production.
- Event store: `drop_events` (MongoDB Atlas), collection `storefront_events`.
- Notification source: `drop-production` in Notifire.
- Domain: a reserved example domain or Teqnyk-owned subdomain.
- Attribution: Drop by Teqnyk, where appropriate.

The same fixtures serve all three products, which is the point: a reader who
meets Maya on beaam.app and again on spanna.app is being shown one company, not
three unrelated tools. Screenshots must be captured from the same seeded state
so the numbers agree across sites — 38 of 100 sold on Beaam's docs and 41 on
Spanna's would undo in one glance what the shared fixture is for.

## 19. Success measures

### Demonstration success

- A viewer understands Drop within ten seconds.
- A presenter introduces an incident within one minute.
- Beaam detects it within the expected collection window.
- The incident has a clear customer or revenue consequence.
- Recovery is reliable and the environment resets without database work.
- A complete demonstration can be recorded in under five minutes.

### Documentation success

- Drop is used consistently across most Beaam examples.
- Integration documentation shares one coherent sample stack.
- Screenshots no longer require one-off fabricated data.
- Technical examples can link to working reference code.
- Prospective users can map Drop's architecture to their own product.

### Technical success

- Controlled incidents produce expected telemetry.
- Scenarios automatically expire.
- Demo payments are safe and non-billable.
- Sensitive data never enters telemetry.
- Synthetic checks distinguish availability from working checkout.
- Operating costs stay within a defined budget.

## 20. MVP acceptance criteria

The first usable version is complete when:

- The Form/01 product page is polished and responsive.
- A customer can complete a test-mode purchase.
- Inventory reservation and reduction are correct.
- The order appears in the creator dashboard.
- Confirmation is generated or captured by a safe destination.
- A secure download entitlement is created.
- Drop emits useful metrics, traces, and logs.
- Drop is connected to Beaam as a production-like stack.
- `/demo` supports slow checkout, payment failure, email failure, and telemetry
  silence.
- Every scenario automatically expires.
- One action restores and verifies healthy state.
- At least three end-to-end Beaam demo scripts are documented.
- Seed data restores the canonical Soft Theory release.
- Setup and operating instructions are included.

The unified MVP additionally requires:

- Every purchase carries one `purchase_id` visible in Drop, the Beaam trace, the
  MongoDB event documents and the Notifire event (§25).
- All customer and creator notifications are published to Notifire; Drop calls
  no email provider directly.
- The MongoDB event store holds a believable seeded release history, and the
  three canonical Spanna questions can be answered against it.
- **Restore healthy state** resets all three products, not only Drop.
- The five-minute unified script has been run end to end and recorded once.

## 21. Delivery phases

1. **Visual storefront:** Establish the identity, build the canonical product
   page, add responsive and failure states, and seed Soft Theory.
2. **Purchase journey:** Add inventory reservation, test checkout, signed
   webhooks, orders, entitlements, and confirmation delivery.
3. **Creator dashboard:** Add sales, revenue, inventory, recent orders, and
   fulfilment visibility.
4. **Observability:** Add OpenTelemetry, business signals, provider integrations,
   Beaam connections, thresholds, and notification routes.
5. **Demo controls:** Implement protected, expiring failure scenarios and global
   recovery verification.
6. **Documentation package:** Write scripts, capture visual fixtures, add
   diagrams, publish reference code where appropriate, and adopt Drop across
   Beaam documentation.
7. **Notifire adoption:** *(deferred 21 Aug 2026 — see §23.)* Move every
   message from direct email to published Notifire events, add the creator
   notification-preferences screen, and add the provider-failure scenario that
   proves persistence.
8. **Spanna adoption:** Add the MongoDB event store and its seeded history, vault
   the connection, and write the three canonical questions as documentation.
9. **Unification:** Thread `purchase_id` through all four systems, add the
   cross-product deep links, extend **Restore healthy state** to reset all three,
   and rehearse the five-minute script. *While Notifire is deferred this covers
   Beaam and Spanna only — two products, one thread, still the whole argument.*

Phases 1–6 stand alone: Drop is a complete Beaam demonstration at the end of
phase 6, and 7–9 extend rather than block it. That ordering is deliberate —
Beaam is the product closest to needing this, and a demo application that is
never finished helps nobody.

## 22. Canonical demonstration script

### The launch that starts losing sales

1. Open Drop's Form/01 storefront.
2. Show 38 copies sold and healthy checkout.
3. Show the healthy Drop production stack in Beaam.
4. Enable the payment-failure scenario.
5. Generate several checkout attempts.
6. Show that the storefront remains available.
7. Wait for Beaam to detect the payment-failure increase.
8. Open the incident and show the affected service, start time, payment-provider
   evidence, customer/revenue impact, and any relevant recent change.
9. Show the founder notification.
10. Disable the scenario and complete a successful purchase.
11. Show Beaam confirm recovery.

Core message:

> An uptime monitor would say Drop was online. Beaam noticed that customers
> could no longer buy.

## 23. Part II — Notifire

> **DEFERRED, 21 August 2026.** Notifire is the least developed of the three
> products, so Drop does not build against it yet. This section is retained in
> full as the design, not deleted: it is what to build when Notifire is ready,
> and deleting it would mean rediscovering the same reasoning later.
>
> **Until then Drop sends email directly through Resend** (§14's original
> arrangement). Say so plainly in any documentation rather than describing an
> integration that is not there — a PRD that reads as shipped is the failure
> mode this document has a hard rule about in §26.
>
> Consequences while deferred: phase 7 is not started; §25's unified
> demonstration runs as **two** products, not three (beat 8 is dropped and the
> script shortens to about four minutes); and §27's first gap — Beaam having no
> Notifire plugin — stops being urgent, because nothing depends on it.

Drop is the reference implementation for an application that hands its
notifications to Notifire rather than calling an email provider directly.

### Why Drop needs it

Drop sends more messages than a storefront first appears to: order confirmation
with the download link, a resend when the customer loses it, a delivery-failed
notice, a sold-out alert to waitlisted customers, and a launch-day summary to
Maya's phone. Written directly against Resend, each of those is its own retry
loop, its own failure state, and its own place to get it wrong — §17 already
requires that "a failed dependency must not produce a valid-looking success",
and that requirement is where hand-rolled notification code usually breaks.

### Scope

- **Publish, don't send.** Drop publishes a typed event to Notifire —
  `order.completed`, `download.ready`, `delivery.failed`, `release.sold_out`,
  `release.daily_summary` — and never selects a transport itself.
- **Fan-out is configuration, not code.** `order.completed` reaches the customer
  by email; `release.sold_out` reaches Maya by push and email; the launch-day
  summary reaches only push. Changing that must require no Drop deploy, which is
  the demonstration.
- **Delivery state is asked for, not assumed.** Drop's dashboard shows the state
  Notifire reports. Accepted is not delivered, and the creator dashboard must
  keep saying so (§9, delivery failure).
- **The creator notification preferences screen** is a small settings page in
  Drop's dashboard, backed by Notifire's channels. It exists so a demo can show
  a routing change taking effect on the next event.
- **Offline resilience is shown, not claimed.** The worker-stopped and email-
  failure scenarios must leave messages *persisted in Notifire and visibly
  queued*, then delivered on recovery without a duplicate.

### Canonical Notifire demonstrations

**Confirmation emails stop, and nothing is lost.** Enable the email-failure
scenario. Purchases keep completing and downloads keep working. Notifire shows
the confirmations accumulating with their retry schedule, and the customer
receives them on recovery — once each. The contrast worth naming: a direct
Resend integration would have dropped them, and the only evidence would have
been an angry customer.

**One event, three destinations.** A sold-out release fans out to the customer
waitlist by email and to Maya by push, from a single published event. Change the
routing in Notifire, publish again, and the destinations change with no
deployment.

**A transform without a deploy.** Notifire transforms are plan-gated (Growth and
above). Use one to reshape Drop's `order.completed` payload for a third-party
webhook — an accounting tool, a Discord channel — showing that integrating a new
consumer is a configuration change, not a Drop release.

**Quota and plan behaviour.** Drop's launch-day burst is a natural demonstration
of per-org event quotas and what a tier boundary feels like from inside an
application, without contriving load.

### Requirements this adds

- Every publish is idempotent on an application-supplied key, so a webhook
  replay cannot double-send a confirmation.
- Notifire API keys use the `ne_live_sk_…` / `ne_test_sk_…` split; demo and
  documentation environments must use test keys, and no raw key may be logged.
- A Notifire outage must degrade Drop honestly: the order still completes, the
  download still works, and the dashboard says the confirmation has not been
  sent yet. It must never silently swallow the message or claim delivery.
- Drop records `notifire_event_id` per dispatch so any message in the dashboard
  can be traced into Notifire during a demo.

## 24. Part III — Spanna

Spanna is a MongoDB GUI for web, desktop and mobile, with connection secrets
sealed in a zero-knowledge vault. Drop gives it a database worth opening.

### Why Drop needs it

Maya's questions on launch day are not schema questions. They are "how many
people saw the page", "where did they come from", "how far did they get before
they gave up", and — the one that matters during an incident — "how many
customers actually hit the failure". Those live in the event store, and a GUI is
how a designer answers them.

### Scope

- **A realistic collection, not a fixture.** `storefront_events` must carry
  enough volume and shape variation to make querying interesting: several
  thousand documents across a release, mixed referrers and devices, nested
  `checkout` objects present on some documents and absent on others. A flat
  collection of 20 identical documents demonstrates nothing.
- **Questions with answers.** The seed data must support, and the documentation
  must show, at least: view-to-purchase conversion for a release; failed
  checkouts grouped by reason during an incident window; and traffic by referrer.
- **Vaulted credentials are part of the demo.** Drop's Atlas connection is added
  to Spanna's zero-knowledge vault, which is the differentiator worth showing —
  the credential for a production database not being pasted into a tool that
  keeps it.
- **Read-only by default.** The demonstration connection should use a
  read-scoped Atlas user. Drop's event store is append-only from the
  application's side; a demo that edits documents live would misrepresent both
  products.

### Canonical Spanna demonstrations

**The funnel question during an incident.** Beaam raises the payment-failure
incident. Maya opens Spanna, filters `storefront_events` to the incident window,
groups `payment_failed` by `failure_reason`, and sees exactly how many customers
were affected and how. This is the moment the three products visibly connect:
Beaam said *something is wrong*, Spanna says *how much and to whom*.

**Launch-day funnel.** Views, checkout starts, completions and downloads for
Form/01, by referrer. A creator's actual question, answered in a GUI, on a
document store, without writing an aggregation pipeline from memory.

**The same data on the phone.** Maya gets the Beaam alert on her phone and opens
the same collection in Spanna mobile. Worth showing because it is the scenario
the desktop-only competitors cannot.

### Requirements this adds

- Seed data generates a believable release history — not uniform random traffic,
  but a launch spike, a long tail, and a visible dent during any seeded incident
  window.
- The event store is populated by the same code path in demo and normal
  operation; a separate "seeding" writer would let the two diverge.
- No document in the event store may contain a customer email, payment
  reference, download token or IP address (§16 applies to Mongo too).

## 25. The unified demonstration — one incident, three products

This is the demonstration the whole application exists for. It is one story, in
one browser, in about five minutes, and it is the only place a viewer sees why
three separate products belong to one company.

The core message:

> An uptime monitor would have said Drop was online. **Beaam** noticed customers
> could no longer buy. **Spanna** showed how many were affected and why.
> **Notifire** proved not one confirmation was lost.

### What makes it one demo instead of three

Three things have to be true, and each is a build requirement rather than a
presentation trick.

**1. One thread runs through all three.** Every purchase attempt carries a single
`purchase_id`, generated at checkout, and it must appear:

- in Drop's order record and dashboard;
- in the OpenTelemetry trace Beaam collects, as a span attribute;
- on every `storefront_events` document in MongoDB;
- as the idempotency key on the Notifire publish, and in its event metadata.

Without that, the demo is three tools looking at similar-shaped data and the
audience has to take the connection on trust. With it, the presenter pastes one
id into each product and the same purchase appears — which is the entire
argument for a shared stack, made in ten seconds.

**2. One clock.** The seeded release history, the incident window and the
recovery must line up across products, so the dent in Spanna's funnel sits at
the same minute as Beaam's incident start and Notifire's retry backlog. Any
clock skew between the demo environment and the providers makes the story look
approximate.

**3. One reset.** §10's **Restore healthy state** must restore all three: clear
Drop's scenarios, drain or clear Notifire's demo queue, and reset the event
store to the canonical seeded history. A presenter must never open Spanna and
find yesterday's demo still in the data.

### The five-minute script

Timings are the target; a run that cannot fit in five minutes has a scenario
detection window that is too long, not a script that is too full.

| # | Beat | Surface | ~Time |
|---|---|---|---|
| 1 | Form/01 is live, 38 of 100 sold, checkout healthy | Drop storefront | 0:00 |
| 2 | The Drop production stack is quiet — every provider green | Beaam | 0:30 |
| 3 | Enable **payment failure**; run several checkout attempts | Drop `/demo` | 1:00 |
| 4 | The storefront is still up. Uptime checks would see nothing wrong | Drop storefront | 1:30 |
| 5 | Beaam raises the incident: elevated payment failures, Stripe named as the likely source, customer impact stated | Beaam | 2:00 |
| 6 | The alert arrives on Maya's phone | Notification | 2:20 |
| 7 | "How many customers actually hit this?" — filter the incident window, group `payment_failed` by reason | **Spanna** | 2:40 |
| 8 | "Did the ones who *did* buy get their download?" — confirmations queued and retrying, none lost | **Notifire** | 3:20 |
| 9 | Disable the scenario; complete one real test purchase | Drop | 4:00 |
| 10 | Beaam resolves the incident; Notifire delivers the backlog once each; the funnel resumes in Spanna | All three | 4:30 |

Beat 7 is the one to rehearse. It is where the demo stops being about
infrastructure and becomes about a business — the presenter is answering the
question a founder would actually ask next, and doing it in a different product
without leaving the story.

### Deep links between the products

The demo must not require the presenter to search. Drop's dashboard carries, on
each order and on the incident banner:

- **"Open in Beaam"** — the service or incident view for that stack.
- **"Open in Spanna"** — the event store, pre-filtered to that `purchase_id` or
  incident window.
- **"Open in Notifire"** — the published event and its delivery state.

These are ordinary links built from ids Drop already holds. They also double as
the honest version of an integration story: this is what "one stack" buys you,
demonstrated rather than asserted.

### Degraded modes the script must survive

A live demo fails in public. Each product must have a defined answer:

- **Beaam has not detected it yet.** The detection window is real and stating it
  is better than waiting in silence — say what it is, and use the wait to run
  beat 7 first. The script's order is a suggestion, not a dependency.
- **Spanna's connection is not unlocked.** The vault is a feature; unlocking it
  on camera is fine, but the presenter should know whether the session has
  expired before starting.
- **Notifire has already delivered the backlog.** Retry is fast when the
  provider recovers. Either show the delivered state with its retry history, or
  keep the email scenario enabled until beat 8.
- **Nothing is failing at all.** The most common demo failure is a scenario that
  expired mid-run (§10 defaults to ten minutes). Check the `/demo` banner before
  starting, and prefer a fresh enable at beat 3.

### Shorter cuts

Not every audience gets five minutes.

- **90 seconds — the product argument.** Beats 1, 3, 4, 5. Ends on "an uptime
  monitor would have said this was fine".
- **3 minutes — the stack argument.** Add beats 7 and 8. This is the one to
  record for the Teqnyk site, because it is the only cut where all three
  products appear.
- **Single-product cuts.** Each product's own site should use the beats that
  belong to it, with the others visible but unexplained — a viewer noticing
  "what's that other tool?" is the point, and the cross-links carry them.

## 26. Honesty constraints (HARD RULE)

Drop is fictional. Maya Chen does not exist, Soft Theory does not exist, and
Form/01 has never been sold to anyone.

That is entirely fine for illustration and entirely unacceptable as evidence.
Beaam's `/proof` page exists specifically to refuse "invented logos,
testimonials or vanity counts", and its credibility is the thing it sells.
Drop must never be the reason that page becomes untrue.

- **Drop may never appear on `/proof`, or in any claim about production
  verification, uptime, customers or usage** — for any of the three products.
- **Every Drop surface must be unmistakably a demonstration.** A screenshot, a
  video, a docs example, a status page: each carries the demo label. A reader
  must never have to work out whether they are looking at a customer.
- **Numbers in Drop are illustrative and must read that way.** "38 of 100 sold"
  is a fixture. It must never migrate into marketing copy as a metric.
- **Demo telemetry is tagged** (`is_demo`) and excluded from anything either
  product reports about itself.
- A drift test should assert that the string `Drop` and the fixture names do not
  appear on `/proof`, in the same spirit as the marketing drift tests added on
  20 August 2026.

## 27. Gaps this exposes in the products themselves

Building Drop against all three surfaces two real gaps. Both are findings, not
blockers, and neither should be worked around inside Drop.

- **Beaam has no Notifire integration.** Beaam offers fourteen providers;
  Notifire is not one, so Drop's notification plane can only be monitored
  generically, via an HTTP check or OTLP. That is a coherent demo but a thin
  one, and it is conspicuous that Teqnyk's monitoring product cannot natively
  watch Teqnyk's notification product. A `notifire` plugin — queue depth,
  delivery success rate, oldest undelivered message — would make the Drop demo
  materially better and is a real integration a Notifire customer would want.
  Note ADR-0044: a new plugin id needs its `integration_type` enum migration
  applied *before* the code deploys.
- **Beaam's own alert delivery does not use Notifire.** It dispatches through
  Resend, Twilio, Expo, Slack and generic webhooks directly. Whether Beaam
  should consume Notifire is a genuine product decision with a real argument on
  both sides — it would dogfood the sibling product, and it would also couple
  two products that currently fail independently, which is exactly what Beaam's
  promise #2 is about. **Do not decide it inside this PRD.** For Drop, the safe
  and honest demonstration is Beaam's generic webhook publishing into Notifire
  as an optional extra, which shows the integration without changing Beaam's
  architecture.

## 28. Future possibilities

- Public source code and one-click deployment templates.
- Multiple reference infrastructure variants.
- A guided “connect Drop to Beaam” tutorial.
- A workshop-friendly chaos mode.
- Recorded incident timelines and load presets.
- A public status page.
- Agent-assisted incident investigation examples.
- A fictional operating history for richer screenshots.
- A companion video series showing Beaam responding to different failures.

These extensions should only be pursued when they improve Beaam's acquisition,
documentation, or product validation.
