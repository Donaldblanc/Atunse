# Atunṣe / RestoredByDJ — Working Spec

Consolidated reference for resuming work after a context reset. Source of
truth for terms is `CONTEXT.md`; source of truth for architectural
decisions is `docs/adr/`; source of truth for outstanding work is
`docs/TODO.md`. This file is a summary/index over all three — if this file
and one of those disagree, the dedicated file wins and this one is stale.

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
- **Item** = one sneaker **pair** (not an individual shoe), carries its own Services, price, and moves independently through the **Status Pipeline**: Request Submitted → Under Review → Quote Sent → Approved → Awaiting Sneakers → In Progress → Quality Check → Ready for Pickup/Shipping → Completed (Cancelled reachable from any state).
- **Approval Gate**: every Item, no exceptions, is manually priced/reviewed by the owner before the customer can pay on it (ADR-0001) — no auto-priced "standard" tier in MVP.
- **Deposit**: one 50% payment per Order at submission, based on published/estimated prices.
- **Balance Delta**: if a custom-quoted Item's final price exceeds its deposit estimate, the delta is folded into the Balance due at completion (deposit never re-charged/refunded) and the customer is notified as soon as the Quote is sent — no surprise at pickup.
- **Guest Order / Customer Account / Account Linking**: guests can order without an account; creating an account auto-matches (by email/phone) and offers past guest orders to link, customer confirms.
- **Manual Payment Confirmation**: Zelle/Cash payments only advance an Order once the owner marks them received in admin (ADR-0002); Apple Pay/card (Stripe, once toggled on) confirms automatically.
- **Policy Acceptance**: single checkbox covering all legal policies (ToS, Refund, Restoration Disclaimer, Payment Policy) at final order review/submit, before the Deposit is charged.
- **Route access**: strictly role-partitioned server-side — `customer` accounts can only reach customer-facing routes (their own orders/account); every other route, including admin and the future customer-import screen, is `admin`-only.
- **Photo retention**: sneaker condition photos are retained indefinitely; accessible only to the owner/admin and the Account that owns the Order.
- **Fulfillment Method**: exactly two, **Pickup** (the shop collects from the customer's address, NY/NJ/CT only) and **Mail-In** (nationwide). **There is no in-person drop-off** (resolved 2026-09-26). The original `docs/notes.txt` answers mention drop-off; that is superseded. Open: how finished sneakers return to Pickup customers, and renaming the "Ready for Pickup/Shipping" status to match (see `CONTEXT.md` open questions).
- **Loyalty rewards**: dropped from MVP entirely (was ambiguous between must-have and deferred in the original notes — resolved to "not in MVP"). Accounts still track order history without any points system at launch.

## Architecture decisions (full text in docs/adr/)
| # | Decision |
|---|---|
| 0001 | Every Item requires manual owner review before pricing — no auto-pricing tier in MVP |
| 0002 | Zelle/Cash payments confirmed manually by the owner in admin, not system-verified |
| 0003 | Single full-stack app, strictly layered: use-cases → repositories → DB; auth checked server-side only; third-party services behind adapters; API versioned at `/api/v1/` from day one |
| 0004 | File storage behind a swappable `FileStorage` adapter; S3 is the initial implementation |
| 0005 | Managed auth provider (Clerk/Auth0/Supabase Auth — TBD which); single auth system with `role` (`customer` / `admin`); MVP `admin` role is a single blanket role, but role checks are per-use-case so finer roles (staff vs. owner) can be added later without rearchitecting |
| 0006 | Notifications: Resend for email (permanent free tier); third-party seam is a `NotificationService` adapter; use-cases write to a DB-backed **outbox table** in the same transaction as the state change, a worker drains it and calls the provider; explicit domain events deferred until a second independent consumer (audit log, analytics) actually exists |
| 0007 | Postgres as the database; GitHub Actions runs the test suite + lint/typecheck in CI |
| 0008 | Hosting: Vercel (app) + Neon (Postgres) — chosen over Supabase to keep DB decoupled from the auth/storage adapters; Resend free tier covers email cost at MVP scale |
| 0009 | SMS deferred behind a feature toggle, off by default — adapter built now, real sending (Twilio or equivalent) turned on once there's budget; email alone covers all required MVP notification events |
| 0010 | Mail-in: MVP only captures + validates the shipping address (address/maps validation adapter); no label generation — that's a future adapter (e.g. Shippo/EasyPost), not an MVP blocker |
| 0011 | Code organized by **feature** first, layers (use-cases/repositories/adapters) inside each feature — refines ADR-0003's layering to avoid global layer folders |
| 0012 | Money (integer-cents value type), idempotency keys, per-use-case authorization, and audit records are explicit domain concerns designed in from the first vertical slice — not infrastructure retrofitted later |

## Guiding build principle
**Establish architectural boundaries early; implement the domain
incrementally through complete vertical slices.** Concretely: pick one real
end-to-end workflow, build it completely (schema → repository →
authorized, idempotent, audited use-case → API → both customer and admin
UI → real notification), prove it, and only then generalize the pattern to
the rest of the use-cases — rather than building every use-case's business
logic before any of them has a working UI or a deployed admin panel to
prove it against.

## Build sequence
**Phase 0 — Skeleton**
- Repo scaffold (Next.js/TS), feature-based folder structure (ADR-0011)
- GitHub Actions CI from commit one — unit tests, plus repository/migration integration tests against a real Postgres service container (not mocked), so schema drift is caught immediately
- Auth wired and **admin routes protected from the very first deployment** — never ship an open `/admin` even temporarily, even before there's anything sensitive behind it
- Narrow initial schema: just enough for the one workflow below (Order, Item, Customer/Account) — not the full domain model up front

**Phase 1 — One real vertical slice, fully engineered**
Pick the core workflow: guest submits an Order with one Item and photos →
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
- Customer account creation + guest-order linking
- Full admin screen inventory (Orders queue, Customers, Settings)

**Phase 3 — Reliability and scale-out of what Phase 1 stubbed**
- Promote the direct notification call into the DB-backed outbox + worker (ADR-0006) once there's more than one notification-triggering use-case
- Stripe behind its feature toggle (TODO)
- Mail-in address validation adapter (ADR-0010)

**Deferred past this list** (tracked in `docs/TODO.md`): SMS, customer data import, mail-in label generation, standalone messages inbox, multi-admin/staff invite flow.

## Admin panel screen inventory (MVP)
1. **Orders queue** — all orders/items, filterable by status; main working view
2. **Item detail** — photos, condition notes, service selection, price/quote entry, status transitions, payment status (incl. manual Zelle/Cash confirmation per ADR-0002), and messages scoped to this item (see below)
3. **Under-Review / needs-action queue** — items awaiting a quote (every item requires manual review, ADR-0001) — where the owner's daily work starts
4. **Awaiting payment confirmation queue** — Zelle/Cash items with a deposit/balance not yet marked received
5. **Customers** — list + detail (contact info, order history, linked guest orders)
6. **Settings** — service/pricing reference list, policy documents. Feature toggles (Stripe, SMS) are **env-var/config-only**, not an admin UI control.

Messaging in MVP lives inside Item detail only — no cross-order inbox yet
(that's a post-MVP toggle, see TODO). Customer data import (TODO) and the
future standalone messages inbox (TODO) are both post-MVP admin screens.

## Open TODOs (full list in docs/TODO.md)
- [ ] Stripe integration (card/Apple Pay) — behind a feature toggle, off by default
- [ ] SMS notifications — behind a feature toggle, off by default (ADR-0009)
- [ ] Customer data import — dedicated admin-only screen, format still TBD, not an MVP-launch blocker
- [ ] Mail-in label generation via third-party carrier API — not in MVP (ADR-0010)

## Open questions — still not resolved
- **Launch date** — explicitly left undecided by the owner (neither "before summer over" nor Sept 26 is realistic against current scope + architecture; revisit once more of the build is scoped)
- Existing customer data's exact source format (spreadsheet? another system?) — not yet confirmed, needed before the import screen can be built

## Not yet grilled at all
Multi-admin/staff invite flow (seam exists per ADR-0005, feature itself not designed) — see docs/TODO.md.
