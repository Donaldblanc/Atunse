# Build status (as of 2026-10-01, after Release 0.5.0)

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
- **Data model** for every admin screen (ADR-0016, #119).
- **Tests:** integration tests use only a `*_test` database (#124).

## Not built (admin screens 2–11 in SPEC's inventory)
Orders list, standalone Order detail page, Calendar, Customers, Services &
Pricing, Inventory, Payments, Messages, Reviews, Settings. Unbuilt screens
show "Soon" in the sidebar (`src/app/admin/admin-screens.ts`).

## Top open items (see TODO.md for the rest)
- **Launch blocker:** nobody tells the shop about a new booking. Add an owner email and/or build the Orders screen.
- **Launch blocker:** sales tax decision. Set `ZELLE_RECIPIENT`/`ZELLE_NAME` and Resend in Vercel.
- Customer "My bookings" page. Customers have no self-serve cancellation or rescheduling.
- Booking still prices from `service-catalog.ts`. ADR-0016 step 2 moves it to the DB tables.
- `develop`'s `package.json` says 0.2.1 while `main` is 0.5.0: release back-merges never landed (TODO, Housekeeping).

## Overview sample data still shown
Unread Messages, Low Stock Items and Recent Reviews (`src/features/admin-overview/sample-data.ts`, tagged "Sample").
