# 0016. The data model mirrors the admin screens; the service catalog moves into the database

## Status
Accepted (2026-09-29). Refines the narrow Phase 0 schema (ADR-0012's build-strategy revision) and the MVP admin screen inventory in `docs/SPEC.md`.

## Context
The owner approved designs for nine admin screens (`scratch/01-09`, not committed): Overview, Orders, Order detail, Calendar, Customers, Services & Pricing, Inventory, Payments and Messages. The schema only held what the first booking slice needed, so most of what those screens show had nowhere to live:
- payments by method and status;
- collection and return times;
- a customer's name;
- an item's size and colorway;
- supplies;
- customer messages.

The Service catalog was code (`src/features/orders/service-catalog.ts`), so the Services & Pricing screen's "Add Service" and Active toggles couldn't work.

## Decision
- **One schema change for every screen** (migration `20260929200000_admin_screens_data_model`), built ahead of the screens themselves:
  - **Payment:** Deposit, Balance or Full; Zelle, Cash or Card; PENDING or RECEIVED.
  - **Appointment:** COLLECTION or RETURN, at most one of each per Order.
  - **Service** and **Bundle**.
  - **InventoryItem** and **Supplier**.
  - **Conversation**, one per Order, with its **Messages**.
  - `Order.number` (sequential from 1001, shown as "ATU-1008"), `Order.dropOffFeeCents` and `Order.taxCents`.
  - `Account.name`, and `Item.size` and `Item.colorway`.
- **Order status stays derived.** The Orders screen's status tabs are computed from the Items' statuses and the Payments; there is still no status column on Order (CONTEXT.md: Order Status).
- **Booking writes the new rows.** `submitOrder` creates the Order's PENDING Deposit Payment (Zelle, the only method offered at booking) and, for Local Drop-Off, its COLLECTION Appointment, in the same transaction as the Order. The Order's `pickupDate`/`pickupSlot` stay as the customer booked them; the Appointment is what the Calendar moves.
- **Payment confirmation is a Payment row, not an audit action.** The Overview's "Awaiting Deposit" reads PENDING Deposit Payments. The migration marks a backfilled Deposit RECEIVED where the owner had already recorded `MANUAL_PAYMENT_CONFIRMED` on one of the Order's Items.
- **The catalog moves into the database in two steps.**
  1. The migration seeds `services` and `bundles` from `service-catalog.ts`. `service-catalog.integration.test.ts` fails if the two disagree.
  2. Booking, the Services page and the booking flow switch to reading the tables. `service-catalog.ts` then stops being the source of prices, and the parity test goes with it.

  Services and Bundles are deactivated, never deleted, because past Items name them.
- **The database enforces the money, time and stock rules too.** CHECK constraints keep amounts and stock from going negative, make a Payment RECEIVED exactly when it has `receivedAt`, and make an Appointment end after it starts.

## Consequences
- Screens 02–09 can be built one at a time with no further migrations for their core data. Each adds its own repository methods and use-cases when it's built, rather than designing them ahead of their screen.
- Until step 2 lands, a price change has to be made in both `service-catalog.ts` and the `services` table (the parity test enforces it).
- Customers still quote `orderReference()` (the last 8 characters of the Order id) in their Zelle memo; admin screens show the order number. Switching customer-facing references to "ATU-1008" is a separate decision.
- Tax and a Local Drop-Off fee are stored but never computed: whether, when and how they apply is an open question (CONTEXT.md).
- Messaging moves into the MVP as an inbox (one Conversation per Order), replacing "messages inside Item detail only".
