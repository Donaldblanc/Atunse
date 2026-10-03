# Build status (as of 2026-10-02: Release 0.5.0 plus the actionable Overview)

Full detail: `docs/SPEC.md` ("Where the build stands"). Open work: `docs/TODO.md`.

## Built
- **Customer site:** `/`, `/services`, `/process`, `/about`, `/contact`, `/booking`.
- **Booking:** five steps (Service → Details → Schedule → Your Info → Review). It submits to `POST /api/v1/orders`, with presigned photo uploads, single pairs and 3-pair Bundles, and server-side prices. Verified end to end locally on 2026-09-30: a booking appears on the admin Overview.
- **Customer Accounts** (ADR-0014): created at first booking. Email-code sign-in sits behind `FEATURE_CUSTOMER_SIGN_IN_ENABLED`.
- **Admin Overview** (`/admin`): live metrics, Recent Orders, Today's Schedule, Needs Attention. Its dialogs open from URL params (#121):
  - date range, metric details
  - Order detail with Update Status, Edit Order, Add note
  - Schedule Item with Reschedule and Mark as Completed
  - Needs Attention with Mark Paid
- **Order flows** (#123/#125):
  - Send Quote, Customer approved
  - status emails at Quote Sent, Ready for Drop-Off/Shipping and Cancelled
  - book a Return visit
  - step back from Under Review to Request Submitted (#122)
- **Every Overview panel is actionable** (`docs/plans/overview-actionable.md`, complete):
  - **New-booking alerts** (#128): a `NEW_BOOKING` Notification in the Order's transaction, plus an email to `CONTACT_EMAIL`. The top-bar bell lists the latest 10.
  - **Visits move pairs + Balance** (#132):
    - completing a Collection moves pairs to In Progress, and a Return moves them to Completed;
    - a PENDING Balance is created when the last pair is Ready;
    - Completed is held until no money is outstanding;
    - Mark Received through `confirmPayment`, and Create Balance for Orders that were Ready before this.
  - **Find orders** (#133): top-bar search, All orders (search, status tabs, paging), Upcoming visits, and the Recent Orders "…" menu (Open, Mark Paid, Cancel order).
  - **Charts drill down** (#134): a bar opens that day's orders, a legend row opens that Service's orders, and the chips open the range picker.
  - **Low Stock and Reviews** (#130): adjust stock (optimistic, audited); Publish, Hide, Reply.
  - **Messages** (#131): real unread count, thread view, Mark read, reply by email (idempotent).
  - Structure (#129): one file per panel in `admin-overview/panels/`, one slot per dialog in `admin-overview/dialogs/` plus its lookup-table line.
- **Data model** for every admin screen (ADR-0016, #119).
- **Tests:** integration tests use only a `*_test` database (#124).

## Not built (admin screens 2–11 in SPEC's inventory)
Orders list, standalone Order detail page, Calendar, Customers, Services &
Pricing, Inventory, Payments, Messages, Reviews, Settings. Unbuilt screens
show "Soon" in the sidebar (`src/app/admin/admin-screens.ts`). Until they
exist, the Overview's dialogs cover the day-to-day actions.

## Top open items (see TODO.md for the rest)
- **Launch blocker:** set `CONTACT_EMAIL` and Resend (`RESEND_API_KEY`, `EMAIL_FROM`) in production. Without them, no owner email for new bookings and no message replies go out (the bell still works).
- **Launch blocker:** sales tax decision. Set `ZELLE_RECIPIENT`/`ZELLE_NAME` and Resend in Vercel.
- Customer "My bookings" page. Customers have no self-serve cancellation or rescheduling.
- Booking still prices from `service-catalog.ts`. ADR-0016 step 2 moves it to the DB tables.
- `develop`'s `package.json` says 0.2.1 while `main` is 0.5.0: release back-merges never landed (TODO, Housekeeping).

## Overview follow-ups (TODO, Admin Overview)
- Per-chart ranges: kept as one page-wide range on purpose.
- Other notification kinds (messages, payments, low stock, reviews).
- How reviews arrive (Request Review after Completed, or imports).
