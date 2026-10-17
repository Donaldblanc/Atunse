# Build status (as of 2026-10-17: develop after #161–#170; main is Release 0.6.0)

Full detail: `docs/SPEC.md` ("Where the build stands"). Open work: `docs/TODO.md`.

## Built
- **Customer site:** `/`, `/services`, `/process`, `/about`, `/contact`, `/booking`.
- **Booking:** five steps (Service → Details → Schedule → Your Info → Review). It submits to `POST /api/v1/orders`, with presigned photo uploads, single pairs and 3-pair Bundles, and server-side prices. Verified end to end locally on 2026-09-30: a booking appears on the admin Overview.
- **Start of Fall Special:** homepage banner links to `/booking?bundle=fall-boots`, a catalog Bundle ($120 for 3 boots, Standard Clean per pair) the server refuses after Dec 21 2026 (New York); the banner hides then (page revalidates hourly).
- **Customer Accounts** (ADR-0014): created at first booking. Email-code sign-in sits behind `FEATURE_CUSTOMER_SIGN_IN_ENABLED`.
- **Admin Overview** (`/admin`): live metrics, Recent Orders, Today's Schedule, Needs Attention. Its dialogs open from URL params (#121):
  - date range, metric details
  - Order detail with Update Status, Edit Order, Add note
  - Schedule Item with Reschedule and Mark as Completed
  - Needs Attention with Mark Paid
- **Standalone Order detail** (`/admin/orders/[id]`): the Overview's `?order=` dialog content, promoted to its own page and URL. Reuses `getOrderDetail` and the dialog's action forms.
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
- **Reviews** (`/admin/reviews`): the full-list version of the Overview's Recent Reviews panel — PENDING/PUBLISHED/HIDDEN tabs, Publish, Hide, Reply.
- **Tests:** integration tests use only a `*_test` database (#124).
- **Customers** (`/admin/customers`, `/admin/customers/[id]`): list of Customer Accounts with order counts; detail shows contact info and order history, each Order linking to `/admin/orders/[id]`.
- **Admin Calendar** (`/admin/calendar`): a month grid of scheduled visits, built on `getAdminCalendar` (same `listAppointmentsBetween` query and live-visit filter as Today's Schedule). A visit opens the Overview's Schedule Item dialog (`/admin?visit=`) for its details, Reschedule and Mark as Completed.
- **Orders list** (`/admin/orders`): search, status tabs, day/service filters and paging, reusing the Overview's All-orders logic. Rows link to `/admin/orders/[id]`.
- **Quote gate scoped to Restoration/Custom-Work** (ADR-0017, supersedes ADR-0001): a Cleaning/Add-on-only Item is created already Approved at its estimate (no Under Review, no Quote). Only a Restoration/Custom-Work Item goes through Send Quote/Customer approved.
  Admin never shows or offers Under Review, Quote Sent or Approved for a pair that needs no quote: it reads Request Submitted (#157).
- **Order detail extras:** per-Service prices, Suede fee and Bundle price (#149); an Order-level audit log for contact edits, notes and reschedules (#150).
- **Payments** (`/admin/payments`, #161): list with method/status breakdown, Record Payment, manual (Zelle/Cash) refunds. A Deposit/Balance can't be refunded while the Order has live pairs; card refunds wait on Stripe.
- **Services & Pricing** (`/admin/services`, #162): Services and Bundles tables with edit panels, images, deactivate (never delete), stale-form check. Edits the `services`/`bundles` tables only: **booking still prices from `service-catalog.ts`** (the page says so).
- **Messages** (`/admin/messages`, #163): inbox with search, status tabs, channel filter, paging, thread view with Mark read and email reply, New Message (emails the customer), archive.
- **Settings** (`/admin/settings`, #164): Business Profile (details, logo, hours, Local Drop-Off/Mail-In switches) and the admin's own account (name, email with password, password). **Not read by the customer site yet**: booking still uses `pickup-window.ts`.
- **Admin security hardening** (#168): revocable sessions (`Account.sessionVersion`), `__Host-` cookies, scrypt N=2^17 with rehash on login, email change needs the password, rate-limited password checks, Origin/JSON guards on admin API routes (ADR-0014 amendment, `gotchas.md`).
- **Booking age check and cancellation** (#167): birth month/year on Your Info, 18+ enforced server-side and stored on the Order; "Need to cancel? Email us at `CONTACT_EMAIL`" on Review, Confirmation and the confirmation email.
- **Copyright Policy** (`/copyright`, #165): DMCA notice and counter-notice page, hidden (404, no footer link) until `DMCA_AGENT_*` are set.
- **Accessibility** (#166): reviews carousel Pause/Resume, marquee stops on reduced motion, `aria-current` on the tab bar; no accessibility overlay, by decision (TODO, Accessibility).

## Not built (admin screens in SPEC's inventory)
Inventory: the only sidebar entry still marked "Soon" (`src/app/admin/admin-screens.ts`). Low stock is handled from the Overview until then.

## Top open items (see TODO.md for the rest)
- **Launch blockers (owner):** Privacy Policy PDF must mention birth month/year; sales tax decision; set `CONTACT_EMAIL`, Resend (`RESEND_API_KEY`, `EMAIL_FROM`, monitored) and `ZELLE_RECIPIENT`/`ZELLE_NAME` in Vercel; register the DMCA agent.
- **ADR-0016 step 2:** booking and the site read the DB catalog and Settings instead of `service-catalog.ts`/`pickup-window.ts`. Carry over the catalog-only Bundle fields (`endsAt`, `pairServiceIds`, e.g. `fall-boots`).
- Enforce the CSP (report-only today; audit finding 9).
- Customer "My bookings" page: no self-serve cancellation or rescheduling (customers email `CONTACT_EMAIL`).
- Preview deploys run `prisma migrate deploy` (the `build` script): give Preview its own database so unmerged migrations never reach a shared one.

## Overview follow-ups (TODO, Admin Overview)
- Per-chart ranges: kept as one page-wide range on purpose.
- Other notification kinds (messages, payments, low stock, reviews).
- How reviews arrive (Request Review after Completed, or imports).
