# Domain cheat sheet

Definitions live in `CONTEXT.md`; this is the working summary.

## Item status pipeline (`src/features/orders/domain.ts`)
`REQUEST_SUBMITTED → UNDER_REVIEW → QUOTE_SENT → APPROVED → AWAITING_SNEAKERS →
IN_PROGRESS → QUALITY_CHECK → READY_FOR_PICKUP_SHIPPING → COMPLETED`, plus
`CANCELLED` from any state. The only backward step: `UNDER_REVIEW → REQUEST_SUBMITTED` (#122).

`adminStatusMoves` (the admin's plain Update Status, in the dialogs and the API) offers **every other status**: forward, back, or skipping steps, including Quote Sent, Approved and Completed. Nothing is held for the Deposit or the Balance. A pair that needs no Quote (ADR-0017) is never offered `REQUEST_SUBMITTED`, `UNDER_REVIEW`, `QUOTE_SENT` or `APPROVED`, and the server refuses those moves too. `COMPLETED` and `CANCELLED` stay final (no moves out). The repository's `enforceCompletionHold` flag still exists but the use-case passes `false`.

`completionHold` and the Deposit-pending rule still guard Return completion (`planVisitMoves` uses the private `visitStatusMoves`): a Return visit completes a pair only when no money is outstanding.

Completing a visit (`completeAppointment`) moves pairs in the same transaction (`planVisitMoves`): a Collection takes Awaiting Sneakers to In Progress, a Return takes Ready for Drop-Off/Shipping to Completed. Held pairs stay and the dialog says why. A replay moves nothing.

The Order has no status of its own; it is rolled up from its Items for display.

**Quote gate (ADR-0017, supersedes ADR-0001):** an Item created with only Cleaning/Add-on Services (`itemRequiresQuote` false, `service-catalog.ts`) starts `APPROVED` with `price` set to its estimate, skipping `REQUEST_SUBMITTED`/`UNDER_REVIEW`/`QUOTE_SENT`; the repository logs a system `AUTO_APPROVED_SET_PRICE` audit entry (no actor). Only an Item with a Restoration/Custom-Work Service goes through the full pipeline above. Admin display for a no-quote pair (old Orders included): the four early statuses all show as "Request Submitted" (`displayStatus`, `orderDisplayStatus`), and its timeline is `statusPipeline(false)` (no Under Review/Quote Sent/Approved). An Order uses the full pipeline if any live pair needs a Quote. Admin status filters match the displayed status.

## Customer emails (`status-emails.ts`, `visit-emails.ts`)
- Emails go out at Quote Sent, Ready for Drop-Off/Shipping and Cancelled, plus when a visit is rescheduled or a return is booked. Other steps are silent.
- They are sent after the DB write, and never on an idempotent replay.

## Audit actions (`ItemAuditEntry`)
`STATUS_TRANSITION` (from/to in metadata, the step back included; a move made by completing a visit also carries `metadata.reason`, `COLLECTION_COMPLETED` or `RETURN_COMPLETED`), `QUOTE_SENT`,
`APPROVAL_RECORDED`, `MANUAL_PAYMENT_CONFIRMED` (a Deposit or Balance; metadata has the payment id, kind and method), `DETAILS_EDITED`, `AUTO_APPROVED_SET_PRICE` (system action, no actor: a Cleaning/Add-on-only Item created straight to Approved, metadata has `priceCents`).

Order-level actions (`OrderAuditEntry`, keyed by order): `ORDER_CONTACT_EDITED` (field names only), `ORDER_NOTE_ADDED` (note id and length, never the text), `ORDER_RESCHEDULED` (appointment id and kind, from/to times). Contact edits before this table existed stay on the first pair's `ItemAuditEntry`.

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
- Balance = quoted total (Rush included, `quotedTotal` in `domain.ts`) − Deposit. It is a PENDING `BALANCE` Payment, created in the transition that readies the last live pair (key `balance:<orderId>`, `planBalance`), recomputed on a cancelled pair, FAILED if the Order is cancelled. It has no schema status for "cancelled", so FAILED stands in.
- `confirmPayment(paymentId, method)` marks a Deposit or Balance received (Zelle or Cash, the owner may change the method).
- Tax and the Local Drop-Off fee are stored but never computed (open question).
- Prices come from `service-catalog.ts` on the server. The client's prices are ignored.

## Order numbers
`ATU-<number>` from a DB sequence starting at 1001. The sequence never resets, so gaps are normal.
