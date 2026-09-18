# 0012. Money, idempotency, authorization, and auditability are explicit domain concerns

## Status
Accepted

## Context
It's tempting to treat these as infrastructure/plumbing bolted on around
the "real" business logic. In this domain they aren't optional hardening —
they're load-bearing: deposits and balance deltas are real money with
real customers disputing real charges; the approval gate and manual
payment confirmation (ADR-0001/0002) are trust-sensitive owner actions;
mis-double-charging a Zelle deposit or silently re-sending a "quote ready"
notification erodes the exact trust this business runs on.

## Decision
Each of these is designed into the use-case layer from the first vertical
slice, not retrofitted:
- **Money**: a dedicated `Money` value type (integer cents + currency), never a raw float, used everywhere a price/deposit/balance is represented. No money arithmetic outside this type.
- **Idempotency**: every use-case that causes a real-world side effect (charging a card, marking a manual payment received, sending a notification) accepts or generates an idempotency key and is safe to retry. A retried "confirm deposit received" click must not double-count.
- **Authorization**: every use-case takes the acting user/role as an explicit parameter and checks it itself (per ADR-0003/0005) — authorization is not a route-middleware-only concern; a use-case is never "trusted" just because it was reached through an authorized route.
- **Auditability**: every state-changing use-case (status transition, quote sent, payment confirmed, manual override) writes an audit record — who did what, when, from what previous state. This is what makes "why is this order in this state" answerable months later, and is a prerequisite for ever introducing domain events (ADR-0006) cleanly.

## Consequences
- More to design in the first vertical slice than a bare CRUD version would need — the "one real workflow" (per the build-strategy revision) must include a `Money` type, at least one idempotency key, an authz check, and an audit write from day one, so every use-case after it follows the same shape by default rather than by retrofit.
- Audit records are a natural second consumer of the same facts notifications need — the moment they exist, they're the evidence for promoting the outbox pattern (ADR-0006) into explicit domain events, per that ADR's own deferral condition.
- Small amount of ceremony per use-case (idempotency key threading, audit write) that pays for itself the first time a payment or status dispute needs a real answer.
