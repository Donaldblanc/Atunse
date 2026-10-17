# Plan: Services & Pricing, Payments, Messages, Settings

**Status: draft, not yet started.** Scopes the four screens still "Soon" in
the sidebar (`src/app/admin/admin-screens.ts`): Services & Pricing,
Payments, Messages, Settings. Reviews is already built; Inventory stays out
of scope here (own future slice).

**Source of truth: the per-screen design files**
(`scratch/services-pricing.jpeg`, `scratch/payments.jpeg`,
`scratch/messages.jpeg`, `scratch/settings.jpeg`), not
`scratch/image copy 15.png`. That combined image is a rough preview and
undersells each screen — checked each one against its full-size design and
revised scope below accordingly (see "Corrections vs. the combined mock").

The data model for all four already exists (ADR-0016): `Service`, `Bundle`,
`Payment`, `Conversation`/`Message`, `BusinessSettings`, `OperatingHours`.
This plan is UI + use-cases + repositories on top of it — no new migrations
expected, only new indexes if a filter needs one.

Same process as `docs/plans/overview-actionable.md`: one PR per slice off
`develop`, one fresh session per PR (Opus plans ~15 lines, `implementer`
builds, `test-runner` checks, Opus + `reviewer` review before the PR).

## Order, set up to avoid merge conflicts
```
PR 1 Messages            (reuses src/features/messages, admin-overview's
                           message-actions.ts and messages-dialog.tsx —
                           smallest slice, do first to prove the pattern)
PR 2 Payments            (new src/features/payments: list + method/status
                           breakdown, reusing Payment data Mark Paid/Refund
                           already write via admin-overview/order flows)
PR 3 Services & Pricing  (new src/features/services: Services tab CRUD +
                           Bundles tab; Add-Ons/Categories tabs can be a
                           follow-up if Services+Bundles alone is large)
PR 4 Settings            (new src/features/settings: Business tab only —
                           Business Information + Business Hours, matching
                           the image; Notifications/Booking/Payments/
                           Integrations/Team tabs are stubs or a later slice)
```
PRs 1-3 touch disjoint files (own feature directory each) and can run in
parallel if needed; Settings (PR 4) is independent of all three. Sequential
is simpler for a solo maintainer and avoids four review passes at once.

## Shared ground rules (from `docs/kb/patterns.md`)
- Each screen: `src/app/admin/<screen>/page.tsx` + `page.test.tsx`, flip
  `built: true` for that id in `admin-screens.ts` in the same PR.
- New feature directory `src/features/<area>/` with `deps.ts`,
  `use-cases/`, `repositories/` (Prisma + in-memory pair, same interface).
- List/table screens copy `admin-customers` or `admin/orders` (search,
  paging, filters) rather than inventing a new shape.
- Writes (Service edit, Settings save, Payment status change) are admin
  server actions (`"use server"`, `requireRole`, idempotency key, named
  errors) per the Admin server action pattern.
- Styles in a per-area CSS file, classes prefixed per area (`sv-`, `pm-`,
  `st-`), not appended to `admin-theme.css`.
- Docs in the same PR: tick `docs/TODO.md`, update `docs/kb/status.md`
  only in the wrap-up PR (like the Overview plan did).

## PR 1 — Messages (`/admin/messages`)
- List Conversations: search, All/Unread/Archived tabs, plus status and
  channel filter dropdowns.
- Thread view reuses `message-reply-form.tsx`'s reply action; add a New
  Message action if there's no existing use-case to start a Conversation
  not yet tied to a reply (check `src/features/messages/use-cases` first).
- **Right-side context panel** (design shows this, the combined mock
  didn't): the open thread's linked Order — status, pickup info, pairs,
  total, Edit Order link — plus Customer Information (with Edit) and that
  customer's Recent Orders. Reuse `getOrderDetail`/`getCustomerDetail`
  read paths rather than writing new queries.
- Reuse `src/features/messages/use-cases` for the data; check
  `src/features/admin-overview/messages-dialog.tsx` first for an existing
  inbox-list query to extend instead of duplicating.
- TODO.md (#256) calls this "one Conversation per Order" for MVP, but
  `Conversation.orderId` is optional in the schema (a Conversation can
  start before any booking). Build the list to handle a null `orderId`
  (context panel shows Customer Information only, no Order card) rather
  than assuming every row has one.

## PR 2 — Payments (`/admin/payments`)
- Stat cards: Total Revenue, Paid Payments, Pending Payments,
  Failed/Refunded, each with a vs.-last-period delta — **not** the
  donut-chart breakdown from the combined mock; the full-size design uses
  four stat cards instead. Build to the full-size design; drop the donut.
- Table: date, order #, customer, amount, method, status, reference,
  paged, with row checkboxes, search, payment-method/status filters and a
  date range (reuse `overview-range.ts`/`overviewHref`).
- **Record Payment** (header button) and **Refund Payment** (detail
  panel) are real writes, not navigate-only as first scoped. Check for
  existing use-cases before adding new ones:
  - Refund likely needs a new use-case (`refundPayment`) — no "Refund"
    action exists yet in `admin-overview`'s Mark Paid flow; confirm by
    grepping `src/features/orders/use-cases` and `admin-overview` before
    assuming.
  - Record Payment (manually logging a payment against an Order, outside
    the Deposit/Balance flow) is new; scope its validation (which Order,
    amount, method) before building — ask the owner if this is for
    recording a payment method not already covered by Mark Paid, or a
    duplicate control for the same action.
- Payment Details side panel: reuses the clicked row's data plus a
  Payment Timeline (derived from `Payment`/audit timestamps, not a new
  table) and a View Order link.

## PR 3 — Services & Pricing (`/admin/services`)
- All Services tab: table (service, description, price, category, status,
  actions), filterable by category/status, search. "From $25+" minimum
  pricing and the suede fee already model as `isMinimum`/
  `suedeUpchargeCents`-equivalent (`suedeFeeCents`) — surface, don't
  recompute.
- Edit Service side panel (richer than first scoped): name, description
  (with char counter), base price, suede upcharge, category, Active
  toggle, up to 5 Service Images (reuse the FileStorage adapter, ADR-0004,
  same as other image uploads), internal notes (char counter), Save.
- **"Delete Service" in the design vs. the schema rule:** `Service` is
  "never deleted, since past Items name it" (schema comment). Map the
  design's Delete button to deactivate (same effect as the Active toggle
  off, with a confirm step since it reads as destructive to the admin) —
  don't add a real delete path. Flag this mapping in the PR description.
- Bundles tab: same table shape, `Bundle` rows, Add Bundle, same
  Edit/Delete-means-deactivate handling (`Bundle.active`).
- Additional Services tab: the design shows this as a separate tab even
  though "Additional"-category rows already appear in All Services
  (filterable by category) — likely the same data, filtered, not a
  separate list. Confirm with a quick look at the design again before
  building a second query; probably render it as "All Services filtered
  to category=Additional" rather than new state.
- Categories tab: not detailed beyond the tab label in either design.
  Scope as a follow-up once the above ships — don't guess its shape.

## PR 4 — Settings (`/admin/settings`)
Tabs per the full-size design and TODO.md's own list (not the combined
mock's guessed labels): **Business Profile**, **Operating Hours**,
Notifications, Payments, Shipping & Pickup, Email & Templates, Team,
Billing. TODO.md (#182) explicitly calls the six tabs after Operating
Hours "not modeled yet" — build Business Profile + Operating Hours only;
the rest render as disabled/"Soon" tab targets, same convention as the
sidebar's unbuilt screens.
- **Business Profile tab** (the design shows Operating Hours, Booking
  Settings, Business Logo, Account Settings and Integrations all rendered
  together under this one active tab, despite Operating Hours also having
  its own tab entry — build it as shown, one scroll of sections, and treat
  the separate "Operating Hours" tab as a future deep-link into the same
  section rather than a second page):
  - Business Information form over `BusinessSettings` (name, tagline,
    owner name, email, phone, address, time zone, currency).
  - Business Logo upload/remove, same FileStorage adapter as Service
    images.
  - Operating Hours grid over `OperatingHours` (7 rows, open/closed +
    start/end time).
  - **Booking Settings toggles** (Allow Pickup Bookings / Allow Mail In
    Orders) over `BusinessSettings.allowLocalDropOff`/`allowMailIn` —
    this is the write side of TODO.md #181 ("Booking reads Settings").
    Building these toggles doesn't by itself make `/booking` honor them;
    call out in the PR description that `submitOrder`/the booking flow
    still reads `pickup-window.ts` until that separate TODO lands, so
    flipping a toggle here won't yet change customer-facing booking
    behavior.
  - Account Settings (admin's own name, email, change password) — this is
    the signed-in admin Account, not `BusinessSettings`; check
    `src/features/accounts` for an existing self-service update path
    before adding one.
  - Integrations panel: **read-only status only** (Connected/Not
    Connected pills for Stripe/Email/SendGrid/SMS/Twilio, sourced from
    which env vars are set) — SPEC.md is explicit that feature toggles
    stay env-var/config-only, not an admin UI control. No "Connect"
    button, no write path.
  - Danger Zone / Delete Account: out of scope for this PR — flag as a
    deliberate omission (destructive, needs its own design/confirm-step
    decision) rather than build it opportunistically.
- Save Changes is one admin server action writing the touched
  `BusinessSettings`/`OperatingHours` fields in a transaction.

## Out of scope here
- Inventory (own future slice, data model already exists per ADR-0016).
- Services & Pricing's Categories tab, Settings' Notifications/Payments/
  Shipping & Pickup/Email & Templates/Team/Billing tabs, Settings' Danger
  Zone — flagged above as deliberate follow-ups, not oversights.
- Booking still pricing from `service-catalog.ts` instead of the `Service`
  table (TODO #257), and still reading `pickup-window.ts` instead of
  `BusinessSettings`/`OperatingHours` (TODO #181) — Services & Pricing and
  Settings editing these DB rows does **not** yet change what customers
  see in `/booking` until those two TODOs land; call this out in each
  PR's description so it isn't read as a bug.
- DB indexes for the new filters/sorts (Payments' method+status+date,
  Messages' status+channel) — add per TODO #102/#105's existing note once
  the screens are built and the busiest queries are known, not pre-emptively.

## Corrections vs. the combined mock (`image copy 15.png`)
- Payments: no donut/method-breakdown chart in the real design — four
  stat cards instead, plus Record Payment and Refund Payment writes the
  mock didn't show at all.
- Messages: the mock showed only the list + thread; the real design adds
  a right-side Order/Customer context panel and filter dropdowns.
- Settings: the mock implied one "Business" tab with just Info + Hours;
  the real design's active tab also includes Logo, Account Settings,
  Integrations (read-only) and Danger Zone, and the tab strip matches
  TODO.md's list (Business Profile, Operating Hours, Notifications,
  Payments, Shipping & Pickup, Email & Templates, Team, Billing), not the
  mock's guessed labels.
- Services & Pricing: broadly consistent, but the real design's Edit
  Service panel is richer (images, notes, suede upcharge) and its Delete
  button needs mapping to deactivate per the schema's no-hard-delete rule.
