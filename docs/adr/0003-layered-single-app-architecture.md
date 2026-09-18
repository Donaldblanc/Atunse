# 0003. Single full-stack app with strict internal layering

## Status
Accepted

## Context
This is a greenfield app, one owner-operator, no existing systems to
integrate with today — but Stripe is coming in behind a toggle (see TODO),
mobile/external API clients are plausible later, and the domain already has
real business logic (item-level status pipeline, approval gate, manual vs.
webhook payment confirmation) that shouldn't leak into request handlers or
UI code.

## Decision
One full-stack app (single deploy, single repo) serving both the customer
site and the admin panel, but internally layered:
- **Business logic** lives in services/use-cases (e.g. `SubmitOrder`, `ApproveItem`, `ConfirmManualPayment`) — framework-agnostic, no direct DB or HTTP concerns.
- **Database access** is behind repositories (`OrderRepository`, `CustomerRepository`, ...) — use-cases depend on repository interfaces, not a specific ORM/query directly.
- **Auth (authentication + authorization)** lives entirely in the backend layer — never trust a client-side role check; every use-case call is authorized server-side.
- **Third-party services** (payments, storage, email/SMS) sit behind adapters — a use-case calls `PaymentGateway.chargeDeposit(...)`, not `stripe.charges.create(...)` directly.
- **API** is versioned from day one at `/api/v1/...` even though nothing external consumes it yet, so exposing it later to a mobile app or partner is additive, not a breaking migration.

## Consequences
- More upfront structure than a "routes call the DB directly" approach — slower to scaffold the first feature.
- Business rules (the item pipeline, approval gate, deposit math) are testable in isolation from HTTP/DB, and swapping a database or adding a second frontend later doesn't require rewriting use-cases.
- Every third-party integration (Stripe, S3, email/SMS provider) must be written as an adapter against an interface the use-case layer owns — this is also what makes the Stripe feature-toggle (see TODO) and the storage swap (ADR-0004) clean to implement rather than scattered `if (featureFlag)` checks through business logic.
