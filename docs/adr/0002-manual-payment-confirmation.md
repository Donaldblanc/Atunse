# 0002. Zelle/Cash payments are confirmed manually by the owner, not the system

## Status
Accepted

## Context
Deposits and Balances can be paid via Apple Pay, Zelle, or Cash. Apple Pay
(via a processor like Stripe) gives a programmatic confirmation webhook.
Zelle and Cash have no API — the money moves outside any system the app can
observe. The Order's progression past Approved depends on the deposit being
paid, so something has to close that loop.

## Decision
For Zelle and Cash, the Order is held until the owner manually marks the
Deposit (or Balance) as received in the admin panel. There is no
self-reported "I paid" customer step in the MVP — the source of truth is
the owner's own action.

## Consequences
- No integration work for Zelle/Cash — by definition, there's nothing to integrate.
- Creates a manual step the owner must remember to do, and a real failure mode: an Order stalls invisibly if the owner forgets to mark it, even though the customer already paid.
- Admin UI must make outstanding manual-payment Orders highly visible (e.g. a dedicated "awaiting payment confirmation" queue) to offset that risk.
- If the business scales past one owner, this step needs either a self-report-then-verify flow or dropping Zelle/Cash as options — revisit then.
