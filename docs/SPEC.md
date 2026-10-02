# Atunṣe / RestoredByDJ — Working Spec

Consolidated reference for resuming work after a context reset. Source of
truth for terms is `CONTEXT.md`; source of truth for architectural
decisions is `docs/adr/`; source of truth for outstanding work is
`docs/TODO.md`. This file is a summary/index over all three — if this file
and one of those disagree, the dedicated file wins and this one is stale.

**New session? Start at `docs/kb/README.md`.** It's a short index of
task-sized notes, so you don't need to read this whole file.

## What we're building
RestoredByDJ (business name) / Atunṣe (public site name): a sneaker
cleaning/restoration business in NYC, serving the NY/NJ/CT Tri-State area
locally and nationwide via mail-in, 72hr turnaround target. Owner: Adedeji
Lawal. Full requirements captured in `notes.txt` at repo root.

The app has two sides: a customer-facing quote/order funnel, and an admin
panel the owner (and eventually staff) uses to run every job end to end.
The prior `demo_mock/` static prototype is throwaway concept only — not the
basis for this build.

## Domain model (see CONTEXT.md for full detail)
- **Order** = billing/shipping container, holds one or more **Items**, no single status field of its own — customer-facing view always shows a **per-Item breakdown**, never a collapsed order-level status.
- **Item** = one sneaker **pair** (not an individual shoe), carries its own Services, price, and moves independently through the **Status Pipeline**: Request Submitted → Under Review → Quote Sent → Approved → Awaiting Sneakers → In Progress → Quality Check → Ready for Drop-Off/Shipping → Completed (Cancelled reachable from any state).
- **Approval Gate**: every Item, no exceptions, is manually priced/reviewed by the owner before the customer can pay on it (ADR-0001) — no auto-priced "standard" tier in MVP.
- **Deposit**: one 50% payment per Order at submission, based on published/estimated prices.
- **Balance Delta**: if a custom-quoted Item's final price exceeds its deposit estimate, the delta is folded into the Balance due at completion (deposit never re-charged/refunded) and the customer is notified as soon as the Quote is sent — no surprise when the pair comes back.
- **Customer Account** (ADR-0014): every booking belongs to an Account, created automatically by the first booking from its email and phone. There are no guest orders and no Account Linking. A signed-out booking whose email already has an Account must sign in with an emailed **Sign-in Code** (the booking flow's own login screen), behind the `FEATURE_CUSTOMER_SIGN_IN_ENABLED` toggle. Customers can only ever see their own photos, through short-lived links.
- **Manual Payment Confirmation**: Zelle/Cash payments only advance an Order once the owner marks them received in admin (ADR-0002); Apple Pay/card (Stripe, once toggled on) confirms automatically.
- **Policy Acceptance**: single checkbox covering all legal policies (ToS, Refund, Restoration Disclaimer, Payment Policy) at final order review/submit, before the Deposit is charged.
- **Route access**: strictly role-partitioned server-side — `customer` accounts can only reach customer-facing routes (their own orders/account); every other route, including admin and the future customer-import screen, is `admin`-only.
- **Photo retention**: sneaker condition photos are retained indefinitely; accessible only to the owner/admin and the Account that owns the Order.
- **Fulfillment Method**: exactly two, **Local Drop-Off** (DJ collects from the customer's address at a booked time and drops the finished pair back off, NY/NJ/CT only; code name `PICKUP`) and **Mail-In** (nationwide; shipped back). Customers never come in person (resolved 2026-09-26; renamed from "Pickup" and return leg decided 2026-09-28). The original `docs/notes.txt` answers mention drop-off; that is superseded. DJ drops Local Drop-Off pairs back off and Mail-In pairs are shipped back; the status reads "Ready for Drop-Off/Shipping" (code name `READY_FOR_PICKUP_SHIPPING`).
- **Loyalty rewards**: dropped from MVP entirely (was ambiguous between must-have and deferred in the original notes — resolved to "not in MVP"). Accounts still track order history without any points system at launch.

## Architecture decisions (full text in docs/adr/)
| # | Decision |
|---|---|
| 0001 | Every Item requires manual owner review before pricing — no auto-pricing tier in MVP |
| 0002 | Zelle/Cash payments confirmed manually by the owner in admin, not system-verified |
| 0003 | Single full-stack app, strictly layered: use-cases → repositories → DB; auth checked server-side only; third-party services behind adapters; API versioned at `/api/v1/` from day one |
| 0004 | File storage behind a swappable `FileStorage` adapter; S3 is the initial implementation |
| 0005 | Managed auth provider (Clerk/Auth0/Supabase Auth — TBD which); single auth system with `role` (`customer` / `admin`); MVP `admin` role is a single blanket role, but role checks are per-use-case so finer roles (staff vs. owner) can be added later without rearchitecting. **Addendum:** until a provider is chosen, an interim in-house email/password login (scrypt hash + HMAC-signed session cookie) sits behind an `AuthService` interface |
| 0006 | Notifications: Resend for email (permanent free tier); third-party seam is a `NotificationService` adapter; use-cases write to a DB-backed **outbox table** in the same transaction as the state change, a worker drains it and calls the provider; explicit domain events deferred until a second independent consumer (audit log, analytics) actually exists |
| 0007 | Postgres as the database; GitHub Actions runs the test suite + lint/typecheck in CI |
| 0008 | Hosting: Vercel (app) + Neon (Postgres) — chosen over Supabase to keep DB decoupled from the auth/storage adapters; Resend free tier covers email cost at MVP scale |
| 0009 | SMS deferred behind a feature toggle, off by default — adapter built now, real sending (Twilio or equivalent) turned on once there's budget; email alone covers all required MVP notification events |
| 0010 | Mail-in: MVP only captures + validates the shipping address (address/maps validation adapter); no label generation — that's a future adapter (e.g. Shippo/EasyPost), not an MVP blocker |
| 0011 | Code organized by **feature** first, layers (use-cases/repositories/adapters) inside each feature — refines ADR-0003's layering to avoid global layer folders |
| 0012 | Money (integer-cents value type), idempotency keys, per-use-case authorization, and audit records are explicit domain concerns designed in from the first vertical slice — not infrastructure retrofitted later |
| 0013 | Prisma for the ORM/migrations; Vitest for both unit and integration tests. `PrismaClient` is only imported inside repositories |
| 0014 | Every booking belongs to a Customer Account (created at first booking; no guest orders), separate from Admin Accounts even for the same email, with separate logins. Customers sign in with emailed codes, only when a booking's email already has an Account; photos are viewable only by their Account's owner or an admin, through 5-minute presigned links. Customer login is behind `FEATURE_CUSTOMER_SIGN_IN_ENABLED` |
| 0016 | The data model mirrors the admin screens (Payments, Appointments, Services/Bundles, Inventory, Conversations); Order status stays derived; the service catalog moves into the database in two steps, parity-tested until booking reads it |

## Guiding build principle
**Establish architectural boundaries early; implement the domain
incrementally through complete vertical slices.** Concretely: pick one real
end-to-end workflow, build it completely (schema → repository →
authorized, idempotent, audited use-case → API → both customer and admin
UI → real notification), prove it, and only then generalize the pattern to
the rest of the use-cases — rather than building every use-case's business
logic before any of them has a working UI or a deployed admin panel to
prove it against.

## Where the build stands (as of 2026-10-01, Release 0.5.0)
**Phase 0 — done.**
- Next.js scaffold with the feature-based layout (ADR-0011).
- CI runs typecheck, lint, unit tests, and integration tests against a real Postgres service container. Integration tests run only against a database named `*_test`, and migrate it themselves (#124).
- `/admin/*` and `/api/v1/admin/*` fail closed via `src/proxy.ts`.
- Narrow schema: `Account`, `Order`, `Item`, `ItemAuditEntry`.
- Interim sign-in (ADR-0005 addendum): `/sign-in`, `POST /api/v1/auth/sign-in` and `sign-out`, and a bootstrap admin created by `npm run prisma:seed`.

**Phase 1 — booking submission connected end to end (single pair).**
- `/booking` → `POST /api/v1/uploads` → presigned photo uploads → `POST /api/v1/orders` → `submitOrder`. A single-pair booking lands in Postgres with its photos, Services, material, Fulfillment Method, address, Local Drop-Off collection slot or preferred mail-in date, Rush and contact name.
- The estimate and 50% Deposit are computed server-side from `src/features/orders/service-catalog.ts`. The browser's display prices in `services-data.ts` are kept in step by a parity test; client-sent prices are ignored.
- Server-side rules: Policy Acceptance, Local Drop-Off only in NY/NJ/CT within the 8:00 AM–10:00 PM collection window, no past dates (New York time), one cleaning tier per pair, 1–10 photos with server-minted keys.
- Submission is idempotent on an `Idempotency-Key` header: a retried Confirm returns the same Order and sends no second email.
- The confirmation (in-flow, and in the email) shows the order reference, estimate, Deposit and Zelle instructions from `ZELLE_RECIPIENT`/`ZELLE_NAME`.
- `FileStorage` adapter (ADR-0004 addendum): S3 presigned POST, plus a local-disk driver for development. Production uploads to the Neon bucket `atunse-images` (verified 2026-09-28).
- `transitionItemStatus` + `POST /api/v1/admin/items/:itemId/transitions`: admin-only, validated against the Status Pipeline, audited, and idempotent when the caller passes a key. It applies `adminStatusMoves`: Quote Sent and Approved are reached only through Send Quote and Customer approved, and a pair can't pass Approved while its Deposit is pending (the API answers 409). The one backward move is Under Review → Request Submitted (#122).
- **Customer Accounts (ADR-0014).** Every booking creates or uses a Customer Account (`orders.accountId` is required). With `FEATURE_CUSTOMER_SIGN_IN_ENABLED` on, a signed-out booking whose email already has an Account gets the booking flow's email-code login screen (`POST /api/v1/auth/code/request` and `/verify`). With it off (the default), that booking attaches to the existing Account.
- **Photo viewing**: `GET /api/v1/orders/:orderId/photos` issues 5-minute presigned GET links to the Order's Account owner or an admin only. A photo key can belong to only one Order.
- Notifications use Resend when `RESEND_API_KEY` and `EMAIL_FROM` are set, otherwise the console logger (where sign-in codes show up in development).
- **Admin Overview** (`/admin`, from the admin design `scratch/overview-dashboard.jpeg`): live figures from real Orders, all admin-only through `getAdminOverview`.
  - One range picker (this week / last week / last 30 days, New York days, Monday-Sunday weeks) scopes Total Orders, Booked Revenue, the Revenue Trend bars and Orders by Service. Each is compared with the same stretch of the period before.
  - "Booked revenue" is the Orders' estimates (Rush included), not payments received.
  - One rule for cancelled pairs across every figure (Total Orders, revenue, the trend, Orders by Service, Recent Orders): they drop out. An Order counts at its estimate less its cancelled pairs' share (`liveEstimate`), and a fully cancelled Order not at all.
  - The work queues are always "right now": pairs needing a quote, Orders whose Deposit Payment is still PENDING (confirming a payment marks it RECEIVED), and pairs Ready for Drop-Off/Shipping.
  - Recent Orders (the five latest, with the first pair's photo through a short-lived view link, an Order status rolled up from its pairs, and the deposit's status) and Today's Schedule (today's scheduled collections and returns, read from the Calendar's Appointments, so a rescheduled visit shows on its new day).
  - Unread Messages is real: the count of customer messages not yet read in unarchived Conversations, opening a dialog (`?attention=messages`) with each thread, Mark read and an emailed Reply.
  - Low Stock Items and Recent Reviews show **sample data** (`src/features/admin-overview/sample-data.ts`, tagged "Sample" on the page): nothing records them yet. `docs/TODO.md` ("Admin Overview: replace sample data") lists what replaces each.
  - **Dialogs** (#121), each opened by a URL param on `/admin`:
    - Date range: presets plus a custom calendar.
    - Metric details: a daily chart plus a status breakdown.
    - Order detail: customer, pairs, a timeline from the audit log, payment, notes, Update Status.
    - Schedule Item: Mark as Completed, Contact Customer.
    - Needs Attention: Pending Payments with **Mark Paid** (`confirmDeposit`: Deposit RECEIVED plus a `MANUAL_PAYMENT_CONFIRMED` audit entry, without moving any pair), Ready to Return, Needs a Quote.
  - **Order flows** (#123, landed by #125):
    - Send Quote: price, confirm step, customer email.
    - Customer approved, recorded by DJ.
    - Customer emails at Quote Sent, Ready for Drop-Off/Shipping and Cancelled.
    - Edit Order: contact, address and pair details, with an optimistic-lock save and audit entries.
    - Add note.
    - Reschedule a visit.
    - Book a Return visit.
  - The shell (black sidebar, search, account menu) lists every designed screen; unbuilt ones show "Soon" and nothing links to them (`src/app/admin/admin-screens.ts`). Search is disabled until the Orders screen exists.
- **Data model mirrors the admin screens** ([ADR-0016](adr/0016-admin-data-model-and-catalog-in-database.md)):
  - Payments (incl. Apple Pay, failed and refunded) and Appointments (with status and assignee).
  - Services and Bundles (seeded from `service-catalog.ts`, parity-tested; with categories, suede fees and image galleries).
  - Inventory Items with stock history and Suppliers.
  - Conversations, Messages and attachments.
  - Reviews, Notes, Notifications.
  - Business settings and operating hours (seeded to match the booking flow, parity-tested).
  - Order numbers (ATU-1001 on), customer names, item size, colorway and condition. Booking creates each Order's PENDING Deposit Payment and, for Local Drop-Off, its COLLECTION Appointment.
- Not built yet:
  - Booking still prices from `service-catalog.ts`; switching it (and the Services page) to the `services`/`bundles` tables is step 2 of ADR-0016.
  - No Balance Payment is created or collected yet. The quote email only states the balance.
  - The owner isn't told about new bookings: no email, and no Orders screen.
  - The other admin working screens (Orders, Calendar, Customers, Services & Pricing, Inventory, Payments, Messages, Reviews, Settings).

**Customer site (marketing + booking UI).**
- Pages: `/`, `/services`, `/process`, `/about`, `/contact` (the form emails the shop's inbox), `/booking`.
- Terms of Service and Privacy Policy are versioned PDFs in `public/legal/` (ADR-0015). `/coming-soon` is still public, but nothing links to it.
- `/booking` is a five-step flow: Service → Details → Schedule → Your Info → Review, then a confirmation.
  - **Service:** one pair with additive Services (one cleaning tier plus any restoration add-ons), or a three-pair Bundle.
  - **Details:** at least one photo per pair.
  - **Schedule:** Local Drop-Off (NY/NJ/CT address plus collection date and time) or Mail-In (any US address, optional date).
  - **Your Info:** name, email, phone, and optional Rush.
  - **Review:** Policy Acceptance checkbox, then Confirm Booking submits.
- **Bundles** book three Items in one Order. The Bundle flow is the default for a bare `/booking`.
  - Each pair has its own details and photos, and Review shows all three.
  - Bundle names, prices and perks come from `BUNDLE_CATALOG` in `service-catalog.ts`, which the server also prices from.
  - Every pair is booked as Premium Clean with the Suede Fee waived. The Order keeps the Bundle id, and the shop assigns the one- or two-pair perks after inspection.

## Build sequence
**Phase 0 — Skeleton** (done)
- Repo scaffold (Next.js/TS), feature-based folder structure (ADR-0011)
- GitHub Actions CI from commit one — unit tests, plus repository/migration integration tests against a real Postgres service container (not mocked), so schema drift is caught immediately
- Auth wired and **admin routes protected from the very first deployment** — never ship an open `/admin` even temporarily, even before there's anything sensitive behind it
- Narrow initial schema: just enough for the one workflow below (Order, Item, Customer/Account) — not the full domain model up front

**Phase 1 — One real vertical slice, fully engineered** (built through the admin Overview's dialogs. Still left: Resend in production, so the customer emails actually go out, and a real pass on production.)
Pick the core workflow: a customer submits an Order with one Item and photos →
owner reviews and sends a quote → customer pays the deposit manually
(Zelle/Cash, ADR-0002) → owner confirms payment → Item moves through the
Status Pipeline to Completed. Build this **one path** all the way through,
with every domain concern from ADR-0012 present in it (Money type,
idempotency on payment confirmation, explicit authz on every use-case,
audit trail on every transition), including:
- Presigned direct-to-S3 uploads (ADR-0004) — browser uploads straight to storage, the app server never proxies the file bytes
- Policy Acceptance checkbox at the submission step itself, not deferred to a later phase
- Real customer UI and real (minimal) admin UI for this one path
- A **synchronous, direct notification call** for this slice — no outbox/worker yet; that infrastructure gets built in Phase 3 when a second notification-triggering use-case makes the reliability problem real (see ADR-0006's own deferral logic, applied to sequencing, not just to domain events)

This slice is the thing that proves the architecture, not a diagram.

**Phase 2 — Generalize to the rest of the domain**
- Multi-item orders, the remaining Services, Balance Delta logic
- Remaining Item Status Pipeline transitions and admin queues (Under-Review, Awaiting-payment)
- Customer "my bookings" page (the photo endpoint and customer sessions already exist, ADR-0014)
- Full admin screen inventory (Orders queue, Customers, Settings)

**Phase 3 — Reliability and scale-out of what Phase 1 stubbed**
- Promote the direct notification call into the DB-backed outbox + worker (ADR-0006) once there's more than one notification-triggering use-case
- Stripe behind its feature toggle (TODO)
- Mail-in address validation adapter (ADR-0010)

**Deferred past this list** (tracked in `docs/TODO.md`): SMS, customer data import, mail-in label generation, multi-admin/staff invite flow.

## Admin panel screen inventory (MVP)
The admin follows the approved design images (`scratch/01-09`); the data model already holds what each needs (ADR-0016).
1. **Overview** (built) — booked orders and revenue for a date range, and the work queues right now. Its dialogs cover Order detail, quoting, Mark Paid, visits and Edit Order until the screens below exist.
2. **Orders** — every Order, with status tabs derived from its Items and Payments, filters by Service, payment method and date.
3. **Order detail** — progress, customer, Items and Services (photos, size, colorway, quote), Payments (manual Zelle/Cash confirmation per ADR-0002), totals.
4. **Calendar** — Local Drop-Off collection and return Appointments, plus pairs in progress and ready.
5. **Customers** — list and detail: contact info, bookings, last booking.
6. **Services & Pricing** — Services and Bundles: prices, descriptions, active or not.
7. **Inventory** — supplies with stock and low-stock alerts, and their Suppliers.
8. **Payments** — every Deposit, Balance and Full payment, by method and status.
9. **Messages** — an inbox of Conversations with customers, usually about an Order (unread, archived, channels, attachments).
10. **Reviews** — ratings and reviews per Order, moderation (publish/hide), replies, Request Review.
11. **Settings** — business profile and logo, operating hours, which Fulfillment Methods are bookable, the admin's own account; integrations shown from environment configuration. Feature toggles (Stripe, SMS) stay **env-var/config-only**, not an admin UI control.

## Open TODOs (full list in docs/TODO.md)
- [ ] Stripe integration (card/Apple Pay) — behind a feature toggle, off by default
- [ ] SMS notifications — behind a feature toggle, off by default (ADR-0009)
- [ ] Customer data import — dedicated admin-only screen, format still TBD, not an MVP-launch blocker
- [ ] Mail-in label generation via third-party carrier API — not in MVP (ADR-0010)
- [x] Connect `/booking` to `POST /api/v1/orders` for a single pair
- [x] Bundles: three Items in one Order, priced from `BUNDLE_CATALOG`
- [x] Photo storage in production: Neon bucket `atunse-images`, uploads verified 2026-09-28
- [ ] Real Terms of Service, Refund Policy, Restoration Disclaimer, Payment Policy and Privacy pages (the Policy Acceptance checkbox links to `/coming-soon`)
- [x] Return leg (2026-09-28): DJ drops Local Drop-Off pairs back off; Mail-In pairs are shipped back. The status reads "Ready for Drop-Off/Shipping"; its code name `READY_FOR_PICKUP_SHIPPING` is unchanged

## Open questions — still not resolved
- **Launch date** — explicitly left undecided by the owner (neither "before summer over" nor Sept 26 is realistic against current scope + architecture; revisit once more of the build is scoped)
- Existing customer data's exact source format (spreadsheet? another system?) — not yet confirmed, needed before the import screen can be built

## Not yet grilled at all
Multi-admin/staff invite flow (seam exists per ADR-0005, feature itself not designed) — see docs/TODO.md.
