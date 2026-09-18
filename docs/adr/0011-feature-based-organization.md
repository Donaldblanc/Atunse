# 0011. Organize code by feature, with layers inside each feature

## Status
Accepted — refines ADR-0003

## Context
ADR-0003 established layering (use-cases → repositories → adapters) but
left open whether those layers are global top-level folders (`/use-cases`,
`/repositories`, `/adapters` each holding every feature's code) or scoped
per feature. A global-layer structure scales poorly as features grow —
every change to "orders" touches three unrelated top-level folders, and
nothing stops "payments" logic from creeping into "orders" use-cases.

## Decision
Organize by **feature** first, **layer** inside each feature second:
```
/features
  /orders
    use-cases/      (SubmitOrder, AddItemToOrder, TransitionItemStatus, ...)
    repositories/   (OrderRepository, ItemRepository)
    api/            (route handlers)
  /payments
    use-cases/      (ConfirmManualPayment, ChargeDeposit, ...)
    adapters/       (StripeGateway — behind the toggle, ManualPaymentLedger)
  /notifications
    use-cases/, adapters/ (Resend, outbox worker)
  /accounts
    use-cases/, repositories/, adapters/ (auth provider)
/shared
    (cross-feature primitives: money type, IDs, the outbox table schema itself)
```
The layering discipline from ADR-0003 (use-cases don't import adapters
directly, DB access only through repositories, auth checked server-side)
still applies — just scoped inside each feature folder instead of as
top-level global folders.

## Consequences
- A feature's code is mostly co-located — easier to reason about, easier to hand off, easier to delete/rewrite one feature without touching others.
- Genuinely cross-feature concerns (money/currency handling, ID generation, the outbox table) live in `/shared` — kept deliberately small to avoid becoming a dumping ground.
- Cross-feature use-case calls (e.g. `orders` calling into `payments` to confirm a deposit) go through the other feature's use-case layer, never reaching into its repositories directly — the feature boundary is enforced the same way the layer boundary is.
