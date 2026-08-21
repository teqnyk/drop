# Drop — Product requirements document

> **Status:** Draft  
> **Product type:** Demonstration application  
> **Primary purpose:** A realistic sample application for Beaam documentation,
> screenshots, demonstrations, videos, and testing  
> **Working tagline:** *Small releases. Big launch energy.*

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

The reference implementation should favour services supported by Beaam:

- Frontend: Next.js or Astro.
- Hosting: Cloudflare Workers/Pages or Vercel.
- Database and authentication: Supabase.
- Payments: Stripe.
- Email: Resend.
- Object storage: Cloudflare R2 or Supabase Storage.
- Error tracking: Sentry.
- Telemetry: OpenTelemetry sent to Beaam.
- Monitoring and alerting: Beaam.

```text
Customer
   ↓
Drop storefront
   ↓
Checkout API
   ├── Inventory and orders database
   ├── Payment provider
   ├── Fulfilment queue
   └── Object storage
             ↓
       Email delivery

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
- Domain: a reserved example domain or Teqnyk-owned subdomain.
- Attribution: Drop by Teqnyk, where appropriate.

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

## 23. Future possibilities

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
