# Plan: every panel on the admin Overview is actionable

**Status: complete (2026-10-02).** Merged as #128, #129, #130, #131, #132, #133 and #134; the wrap-up is the PR that adds this line. Kept as the record of what was decided and why.

Scope: `/admin` only. Decided with the owner on 2026-10-01:
- The sample panels become real and actionable.
- Messages can be replied to by email.
- "View all" links open Overview dialogs.
- New bookings raise a bell notification and email the owner.
- Completing a visit moves its pairs, and the Balance becomes a real payment that gates Completed.

Each slice is one PR off `develop`, run as **one fresh session per PR**:
1. Opus writes the slice plan (about 15 lines).
2. `implementer` (Sonnet) builds it.
3. `test-runner` (Haiku) runs the checks.
4. Opus reviews the diff. The `reviewer` agent also runs where marked 🔒.

Follow `docs/kb/patterns.md` for every use-case, repository method, action and dialog. Every dialog is opened by a URL param built with `overviewHref`.

## Order, set up to avoid merge conflicts
```
PR 1 alerts (#128, merged)
  └─ Groundwork: panels + dialog lookup table   (no behaviour change)
       ├─ PR 2 Visits + Balance   ┐
       ├─ PR 3 Find orders        │ wave 1: run in parallel,
       ├─ PR 5 Stock + Reviews    │ almost no shared files
       └─ PR 6 Messages           ┘
            └─ PR 4 Charts drill-down (after PR 3)
                 └─ Docs wrap-up: docs/kb/status.md, close this plan
```
Rules for wave 1, so the branches don't collide:
- **Own repository per area.** PR 3 adds `OrderSearchRepository`, PR 5 adds `InventoryRepository` and `ReviewRepository`, PR 6 adds `MessageRepository`. Each gets its own Prisma and in-memory files. Only PR 2 changes `OrderRepository`.
- **New panel:** a file in `admin-overview/panels/`.
- **New dialog:** a slot in `admin-overview/dialogs/` plus **one line** in its lookup table.
- **Styles:** in a per-area CSS file, not appended to `admin-theme.css`.
- **Docs:** each PR ticks only its own `docs/TODO.md` entry. `docs/kb/status.md` is updated once, in the wrap-up.
- **Before merging,** update the branch from `develop`. Expected conflicts are one-line ones in `deps.ts` and the lookup table.

## Baseline (already actionable, #121/#123)
- Range picker.
- The 4 stat cards.
- Recent Orders rows (open the order).
- Today's Schedule rows (open the visit).
- Needs Attention: Pending Payments, Ready to Return, Needs a Quote.

## PR 1: New-booking alerts 🔒 (`feature/overview-alerts`), merged as #128
- **Notification row:** `submitOrder` writes a `NEW_BOOKING` Notification (recipient null means every admin) **in the same transaction** as the Order. An idempotent replay writes nothing.
- **Owner email:** sent to `CONTACT_EMAIL` after the write, never on a replay. If it fails, log it through `redactForLog` and still let the booking succeed.
  - The subject is the order number. The body is the number, the first name, the Services, the fulfillment method and the date, plus a link to `/admin?order=`. No full address, phone or email.
- **Bell in the admin top bar** (`src/app/admin/layout.tsx`):
  - shows the unread count;
  - a popover lists the 10 latest notifications;
  - clicking one marks it read and opens `?order=`;
  - "Mark all read" clears them.
- **New code:**
  - use-cases `listNotifications` and `markNotificationsRead`, both admin-only;
  - repository methods with in-memory twins and integration tests.

## PR 2: Visits move pairs + Balance payment 🔒 (`feature/overview-visits-balance`)
Status-rule change: update `CONTEXT.md` (Balance, Appointment) and `docs/kb/domain.md`.
- **Completing a Collection** (`completeAppointment`) moves each live pair in Awaiting Sneakers to In Progress, in the same transaction.
  - Each move is audited as `STATUS_TRANSITION` with the reason `COLLECTION_COMPLETED`.
  - Pairs not yet approved, or whose Deposit hold applies, stay where they are. The dialog lists who moved and who didn't, and why.
  - A replay (the visit already completed) changes nothing.
- **Completing a Return** moves each pair in Ready for Drop-Off/Shipping to Completed, under the Balance rule below.
- **Balance Payment** (ADR-0002):
  - **Created** when an Order's last live pair reaches Ready for Drop-Off/Shipping, in that same transition's transaction.
    - It's a PENDING `BALANCE` Payment for the quoted total (Rush included, the same formula as the quote email) less the Deposit. None is created if that's 0 or less.
    - Its method copies the Deposit's (ZELLE or CASH), and can be changed when it's marked received.
    - It's idempotent on the fixed key `balance:<orderId>` (`@@unique([orderId, idempotencyKey])`), so no migration is needed.
  - **While PENDING:** recompute the amount if a pair is cancelled; if the Order becomes fully cancelled, cancel the Balance.
  - **Blocks Completed:** `adminStatusMoves` holds Completed while a Balance is PENDING. The dialogs, the API route and Return completion all follow it, and the form shows why.
  - **Mark Received:** generalize `confirmDeposit` to `confirmPayment(paymentId, method)`. It sets RECEIVED, `receivedAt` and the confirming admin, writes a `MANUAL_PAYMENT_CONFIRMED` audit entry, and is idempotent on its key.
  - **Where:**
    - the Pending Payments panel gets Deposit and Balance tabs;
    - the Order dialog's Payment section shows the Balance with Mark Received;
    - the Pending Payments count includes Balances.
- **Known edge:** if the Collection is completed before a pair is approved, that pair later takes the normal steps (Approved → Awaiting Sneakers → In Progress) through Update Status.

## PR 3: Find orders (`feature/overview-find-orders`)
- **Repository:** a new `OrderSearchRepository` (Prisma and in-memory) with `searchOrders({ q, status, from, to, serviceId, limit, offset })`.
  - `q` matches the order number (`ATU-1234` or `1234`), the contact name, email or phone, case-insensitively.
  - It uses Prisma `contains`, which is parameterized.
  - Inputs are validated with zod: `q` up to 100 characters, `limit` up to 50.
- **All orders dialog** (`?orders=all&q=&status=&page=`):
  - search box, status tabs (derived Order status), paging;
  - rows open the existing Order dialog.
- **The top-bar search** is enabled and submits to `?orders=all&q=`.
- **Upcoming visits dialog** (`?visits=upcoming`): the next 14 days of SCHEDULED Appointments. Rows open the existing Visit dialog.
- **Links:** "View all orders" and "View calendar" point at these dialogs, through `builtScreenHref` or a new Overview href.
- **Recent Orders "…" menu:**
  - Open order;
  - Mark Paid, when a Deposit or Balance is pending, reusing `confirmPayment` from PR 2;
  - Cancel order, reusing the existing confirm step.

## PR 4: Charts drill down (`feature/overview-chart-drilldown`), after PR 3
- The "This Week" chips open the range picker.
- The Revenue Trend card title opens `?metric=revenue`. Each bar opens All orders for that day (`from=to=day`).
- Each Orders by Service legend row opens All orders filtered by that Service, within the range.
- Every target uses an accessible link, with a focus ring and an `aria-label` such as "Orders booked Wed Sep 30".

## PR 5: Low Stock + Reviews 🔒 (`feature/overview-stock-reviews`)
New `InventoryRepository` and `ReviewRepository`, each with Prisma and in-memory versions.
- **Low Stock** card: the real count of active items with `stock <= lowStockAt`. Its dialog (`?attention=low-stock`):
  - lists those items;
  - **Adjust stock** takes a change, a reason (RESTOCK or ADJUSTMENT) and a note.
    - One transaction updates `stock` and writes a `StockMovement` with the actor.
    - The update is optimistic on the stock the owner saw (`where stock = seen`), so a replay or a stale tab is refused.
    - Stock can't go below 0.
- **Reviews** panel: the latest PUBLISHED reviews.
  - "View all" opens `?reviews=all`, with PENDING / PUBLISHED / HIDDEN tabs.
  - Actions: Publish, Hide, Reply. A reply is stored with `repliedAt` and its author, and isn't emailed.
  - Shows an empty state until reviews exist.
- Delete `SAMPLE_LOW_STOCK_ITEMS` and `SAMPLE_REVIEWS`.

## PR 6: Messages with email reply 🔒 (`feature/overview-messages`)
New `MessageRepository`, with Prisma and in-memory versions.
- **Migration:** `Message.idempotencyKey String? @unique`, so a replayed reply sends no second email (ADR-0012).
- **Unread Messages** card: the real count of CUSTOMER messages with `readAt` null, in Conversations that aren't archived. Its dialog (`?attention=messages`):
  - conversations that have unread messages;
  - the thread, newest last, with a link to the order;
  - **Mark read**;
  - **Reply.**
- **Reply:**
  - stores an ADMIN `EMAIL` Message;
  - bumps `lastMessageAt`;
  - then emails the Conversation's Account email.
  - The body is plain text, 1–5000 characters, and sent as plain text (`text:`), so no escaping.
  - If the send fails, the owner is told and it is logged through `redactForLog`.
- Delete `sample-data.ts` and the "Sample" tag.

## Every PR
- **Security:**
  - `requireRole(actingUser, "ADMIN")` comes before any read.
  - Every URL param is validated, and a bad one falls back to closed.
  - Redirects go to `/admin` only.
  - No customer PII in logs.
  - Server actions carry an `idempotencyKey` field.
- **Tests:**
  - use-case tests against the in-memory repositories;
  - an integration test per new repository method;
  - `copy-rules` still passes (no "pickup").
- **Browser check:** one Playwright screenshot of the changed panel at 1440px and 375px (`docs/kb/testing.md`). Test data comes from `npm run seed:sample`.
- **Docs:**
  - tick the matching `docs/TODO.md` entries;
  - leave `docs/kb/status.md` to the wrap-up PR;
  - update `CONTEXT.md` if a term changes.

## Still undecided (not in these PRs)
- Per-chart ranges (kept as one page-wide range).
- Card/Apple Pay Balance (Stripe, behind its toggle).
