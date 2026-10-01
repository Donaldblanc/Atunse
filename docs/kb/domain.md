# Domain cheat sheet

Definitions live in `CONTEXT.md`; this is the working summary.

## Item status pipeline (`src/features/orders/domain.ts`)
`REQUEST_SUBMITTED → UNDER_REVIEW → QUOTE_SENT → APPROVED → AWAITING_SNEAKERS →
IN_PROGRESS → QUALITY_CHECK → READY_FOR_PICKUP_SHIPPING → COMPLETED`, plus
`CANCELLED` from any state. The only backward step: `UNDER_REVIEW → REQUEST_SUBMITTED` (#122).

`adminStatusMoves` holds three moves, both in the dialogs and in the API:
- **Quote Sent** is reached only through Send Quote.
- **Approved** is reached only through Customer approved.
- **Past Approved** is blocked while the Deposit is pending. A `MANUAL_PAYMENT_CONFIRMED` move is the exception.

The Order has no status of its own; it is rolled up from its Items for display.

## Customer emails (`status-emails.ts`, `visit-emails.ts`)
- Emails go out at Quote Sent, Ready for Drop-Off/Shipping and Cancelled, plus when a visit is rescheduled or a return is booked. Other steps are silent.
- They are sent after the DB write, and never on an idempotent replay.

## Audit actions (`ItemAuditEntry`)
`STATUS_TRANSITION` (from/to in metadata, the step back included), `QUOTE_SENT`,
`APPROVAL_RECORDED`, `MANUAL_PAYMENT_CONFIRMED`, `DETAILS_EDITED`,
`ORDER_CONTACT_EDITED` (recorded on the first pair; there's no Order-level audit table).

## Code names vs. what customers read
| Code | Say this to customers and in UI copy |
|---|---|
| `PICKUP` (Fulfillment Method), `pickupDate`, `pickupSlot` | **Local Drop-Off**: DJ collects from the customer's address and drops it back off |
| `MAIL_IN` | **Mail-In** |
| `READY_FOR_PICKUP_SHIPPING` | **Ready for Drop-Off/Shipping** (lists: "Ready to Return") |
| Appointment `COLLECTION` / `RETURN` | Collection / Return visit |

Never write "pickup" in customer-facing copy (`copy-rules.test.ts` enforces this).

## Money
- Integer cents only (`src/shared/money`). The Deposit is 50% of the estimate, taken at booking as a PENDING Payment.
- Zelle and Cash are confirmed by the owner (Mark Paid, ADR-0002).
- Balance = quoted total − Deposit. No Balance Payment row is created yet.
- Tax and the Local Drop-Off fee are stored but never computed (open question).
- Prices come from `service-catalog.ts` on the server. The client's prices are ignored.

## Order numbers
`ATU-<number>` from a DB sequence starting at 1001. The sequence never resets, so gaps are normal.
