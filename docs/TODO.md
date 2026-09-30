# TODO

## Launch checklist (merged 2026-09-28)
The owner's pre-launch list, checked against the code and the live site (`atunse-five.vercel.app`) on 2026-09-28. **[x]** = verified done (evidence in the line); **[ ]** = still to do, with what's there today. Items already tracked in detail elsewhere in this file say so instead of repeating it.

### Launch blockers found while merging
- [ ] **The shop is never told about a new booking.** The booking confirmation email goes only to the customer (`submitOrder`), and the admin Orders screen isn't built (`src/app/admin/admin-screens.ts`), so today a new booking only shows up as a count on the admin Overview. Add an owner notification email for new bookings and/or build the Orders queue before launch.
- [ ] **Sales tax.** The site charges no tax. New York generally taxes services that maintain or repair tangible personal property, which may include sneaker cleaning and restoration; NJ and CT have their own rules. Confirm with an accountant, then add tax to the estimate, Deposit and totals if needed.

### Legal & policies
- [x] **Privacy Policy**: `public/legal/privacy/2026-09-27-v1.pdf`, linked from the footer, the booking Review step and the contact form's consent. (Its drafting notes still need the legal review above.)
- [x] **Terms of Service**: the Terms of Service & Restoration Agreement, `public/legal/terms/2026-09-27-v1.pdf`, accepted at booking with recorded evidence (ADR-0015); in the footer too.
- [ ] **Refund / cancellation policy**: covered today only by the Terms' section 13 ("Cancellation and Refunds"). Decide whether that's enough or a separate, linked Refund Policy is needed; if so, add it to `src/shared/legal-documents.ts` (it would join the footer automatically).
- [ ] **Cookie policy / consent banner**: decide. The site sets only strictly necessary cookies (the admin and customer session cookies) plus a `localStorage` theme preference; no analytics, ads or pixels. A banner isn't needed for that in the US; revisit before adding analytics or pixels (the Privacy Policy's section 3 says it will be updated then).
- [x] **Consent checkboxes**: booking (four risk acknowledgments plus the Terms Agreement: none pre-checked, Confirm Booking disabled until all are ticked, enforced again by `submitOrder`) and the contact form (consent required client- and server-side). Covered by tests.
- [x] **Terms / Privacy links where customers submit**: the booking Review step links the Terms PDF (from its checkbox) and the Privacy Policy; the contact form links the Privacy Policy; the footer links both on every page. There are no online payments yet (see Payments).
- [ ] **Business details**: the footer shows only "RestoredByDJ · New York, NY". Add the legal business name and a public contact method (email and/or phone); the Contact page shows no email address yet.

### Content & claims
- [x] **Unsupported claims removed**: every guarantee (results, safety, timing) is gone (#106), fulfillment copy matches the business (#105, #108), and `copy-rules.test.ts` fails if they come back.
- [ ] **Placeholder / demo content**:
  - the home page reviews look invented (publishing invented testimonials is a legal risk: replace with real reviews or remove);
  - the Process page's step-1 phone photo shows made-up menu prices;
  - the Process and Contact photos are low-resolution crops from the design mockups (replace with originals);
  - confirm the brand list's Fendi and Alexander McQueen (see the client-feedback entry below).
- [ ] **Pricing and service descriptions**: every price on the site comes from `SERVICE_CATALOG` (#81, #105), and descriptions were reworded in #106. The owner should still confirm the catalog prices, Bundle perks and Add-ons are current. Policies are covered by the legal review.
- [ ] **Proofread** every page for spelling and grammar.

### Accessibility
Audited 2026-09-28 (axe-core, WCAG 2.0/2.1/2.2 A and AA plus best practice) on every page and every booking step, including the date-picker dialog and the warnings, the mobile menu, and the contact form with its error. Light and dark, desktop and phone: **0 violations** after the fixes below, and keyboard and zoom checks by hand-scripted browser runs. Re-run before launch if pages change.
- [x] **Alt text**: every meaningful image has alt text; decorative ones use `alt=""` on purpose, and the hero photos are `aria-hidden`.
- [x] **Colour contrast** (1.4.3 / 1.4.11): the brand blue was under 3.5:1 as text on the dark theme's backgrounds, so text, links and focus rings now use `--blue-text` / `--focus-ring` (`#2955ff` light, `#8ea2ff` dark: 4.6:1 or better everywhere). Also fixed: the Process page's tan (`#7f644e`) and the gallery subtitle (`#f0f3ff`).
- [x] **Keyboard navigation**:
  - a "Skip to content" link comes first, and every page's `<main id="main-content">` receives it;
  - the gallery scroller is focusable and scrolls with the arrow keys;
  - the theme toggle and FAQs work with Enter;
  - the booking flow works start to finish by keyboard, including the date picker.
- [x] **Dialogs** (mobile menu, date picker): `role="dialog"`, `aria-modal`, labelled; focus moves in on open, Tab stays inside, Escape closes, and focus returns to the trigger (`use-dialog.ts`). The closed menu is `inert`, so its links can't be reached with Tab.
- [x] **Visible focus states**: every Tab stop on the home page shows a focus ring in both themes, including inputs, selects and textareas.
- [x] **Every input has a label and states if it's required**: labels on every field; required fields carry `required`, since the red `*` is hidden from screen readers. Calendar days are announced as full dates ("Monday, September 28, 2026") with their selected state; time slots announce theirs.
- [x] **Heading hierarchy and landmarks**: one H1 per page with no skipped levels (axe `heading-order`, `page-has-heading-one`); every page has a `<main>`; the nav, menu, footer and legal links are labelled landmarks.
- [x] **200% zoom and 320 px reflow**: no horizontal scrolling on any page at 640 px (1280 px at 200%) or 320 px wide.
- [x] **Errors not by colour alone**: every warning and error has an icon and text. Booking warnings are now always-present live regions, so screen readers announce them when they appear.
- [ ] **Screen-reader spot check**: automated tests can't replace listening. Do one pass with VoiceOver (iPhone and Mac) through a booking before launch.

### Booking & forms
- [ ] **Full booking flow, start to finish, on production**: automated tests cover submission, and headless runs reached the Review step on the dev server. A real booking on production hasn't been placed.
- [x] **Required fields and validation**: server-side rules in `submitOrder` and `validateContactMessage`, mirrored client-side, with unit tests for invalid email, phone, address, zip, state, dates, services and photos.
- [x] **Consent can't be bypassed**: the button stays disabled and the server refuses the booking without every acknowledgment, the Terms Agreement and the current agreement version (ADR-0015).
- [ ] **Editing before submission**: the Review step's Edit links exist (service, each pair, schedule, contact); do a manual pass.
- [x] **Order summary and totals**: client and server compute the same estimate. Parity tests cover every Service combination × Add-ons × material × Rush, plus Bundles with Add-ons. There are no discounts; tax is the blocker above.
- [ ] **Confirmation page**: manual pass on production.
- [ ] **Confirmation emails**: blocked on Resend (`RESEND_API_KEY` / `EMAIL_FROM`, above).
- [ ] **Cancellation / rescheduling**: no customer-facing flow exists. Decide: by email/contact form for launch (per the Terms' section 13), or build it.
- [ ] **"My bookings" / customer account**: not built (tracked above).

### Payments
Online payment isn't built: Stripe is planned behind `FEATURE_STRIPE_ENABLED` (off). Deposits are paid by Zelle and confirmed manually by the owner (ADR-0002).
- [x] **No double submission**: a per-booking idempotency key returns the same Order on retry (ADR-0012), and a changed retry is refused (#76).
- [x] **Amount matches the displayed total**: the estimate and 50% Deposit are computed server-side from the catalog, and parity tests keep the page's total identical.
- [ ] **Successful / declined / abandoned payment, refunds, production keys, test-mode cleanup**: all wait on the Stripe integration. For Zelle launch: set `ZELLE_RECIPIENT` / `ZELLE_NAME` (above) and decide how refunds are handled (manually, per the Terms' section 13).

### Security & authentication
- [x] **HTTPS everywhere**: live, HTTP redirects to HTTPS (308), and HSTS is sent (`max-age=63072000; includeSubDomains`) along with nosniff, frame, referrer and permissions headers (#88).
- [ ] **Production secrets**: set in Vercel; mark them "Sensitive" there, and keep secrets out of `NEXT_PUBLIC_*` (today only `NEXT_PUBLIC_ASSETS_BASE_URL` is public).
- [x] **Customer auth and sessions**: email sign-in codes and HMAC-signed session cookies (ADR-0014), kept separate from admin sessions.
- [x] **Admin routes require server-side authorization**: `src/proxy.ts`, a second check in the admin layout, and a role check in each use-case (#88), with tests.
- [x] **Customers can't see others' bookings**: the photos endpoint checks ownership and answers 404 otherwise (tests). Re-check when "My bookings" is built.
- [x] **Customers can't reach admin pages or APIs**: admin and customer are separate roles, sessions and cookies (ADR-0014), with tests.
- [x] **Rate limiting**: uploads, orders, contact, sign-in code requests and guesses, and admin sign-in (per IP and per account), in `src/shared/rate-limit`.
- [x] **Server-side input validation**: zod request shapes plus the use-case rules on every public route.
- [x] **CORS**: the photo bucket allows only the site's origins, POST only (#107); the API sends no CORS headers (same-origin only).
- [x] **Cookie flags**: session cookies are `HttpOnly`, `Secure` in production and `SameSite=Lax`.
- [x] **No secrets in frontend code or Git history**: the #88 scan found none. GitHub's secret scanning and push protection are still off (entry above).

### SEO & social
- [ ] **Unique page titles**: every page has its own title except home, which uses the generic "Atunṣe".
- [ ] **Meta descriptions**: only the one site-wide description; add one per page.
- [ ] **Open Graph / social sharing metadata**: none.
- [ ] **Favicon**: none (`/favicon.ico` answers 404).
- [ ] **Canonical URLs**: none; set once the custom domain is decided.
- [ ] **`robots.txt`** and **sitemap**: none (both 404).
- [ ] **Indexable, no staging noindex**: production sends no `noindex`, so it's indexable. The unlinked `/coming-soon` placeholder is still public; remove it or mark it `noindex` before launch.

### Mobile & browser testing
- [x] **Layouts in every browser engine** (2026-09-28): every page in light and dark on WebKit (Safari's engine), Chromium and Firefox, emulating iPhone SE, iPhone 15 (portrait and landscape), Pixel 7, Galaxy S9+, iPad Mini (both orientations), iPad Pro 11 and Galaxy Tab S4, plus desktop Safari at 1280/1440 and Firefox at 1024/1280. The booking flow was walked from the service through the date picker to Review on each. Result: no horizontal scroll, overflow or nav collisions. Fixed along the way:
  - The closed menu drawer's shadow showed as a grey band down the right edge of every page.
  - The booking page's tablet rules (one column at 900px and under) were overridden by later base rules, so tablets got two cramped columns; the step indicator also ran under the summary up to 1140px.
  - iOS zoom on field tap (fields were 13.5px; now 16px on touch screens); fields are 44px tall.
  - Booking step indicator (from a customer's iPhone screenshot): on screens 1180px and under it wrapped like text (three steps, then two, with dangling rules). It's now one row of circles with names underneath, and the rules up to the current step are blue.
  - The date picker sheet uses `dvh`, so iOS Safari's toolbars don't cover it.
  - Safari drew selects 21px tall; the tablet nav crowded "Contact" into the theme toggle (links move to the menu at 641–820px); FAQ rows are tappable across their full width; content scrolled into view stops above the phone tab bar.
  - Tap areas of 44px on touch for the menu button, social icons, carousel arrows and toggles; "View pricing & book now" no longer wraps at 320px.
- [ ] **Real devices**: emulation can't show iOS Safari's toolbars, input zoom, the home-indicator area or how taps feel. Book once (up to Review) and send a contact message on a real iPhone and an Android phone, and check the menu and date picker on an iPad.
- [ ] **Real desktop browsers**: the desktop checks ran in the browser engines (WebKit, Chromium, Firefox), not the browsers themselves. On a Mac and a Windows PC, open every page and book up to Review in Safari, Chrome, Firefox and Edge, including at a narrow window width (the menu) and with the theme toggled.

### Performance
- [ ] **Large images**: `hero-travis-scott-aj1-low.png` (2.1 MB) and `coming-soon-hero.png` (1.9 MB) are served as-is. Images use plain `<img>`, not `next/image`, so nothing is resized per device.
- [ ] **Lazy loading**: step and FAQ photos load lazily; audit the rest.
- [ ] **Core Web Vitals, unnecessary JavaScript, slow connections**: not measured.
- [ ] **Console errors and broken images**: none on the pages checked in headless runs; do a full pass.
- [ ] **Database indexes, once the admin screens are ready for launch** (from the #118 review): the admin Overview filters and sorts `orders` by `createdAt` (both date ranges, Recent Orders) and `pickupDate` (Today's Schedule), and every Order load finds its pairs by `items.orderId`. Without indexes each of these reads the whole table. That's fine at today's size but grows with every booking.
  - `Order` `@@index([createdAt])` and `@@index([pickupDate])`: already on #119's branch (`feature/admin-data-model`); confirm they landed.
  - `Item` `@@index([orderId])`: missing everywhere. Postgres doesn't index foreign keys on its own, and Prisma doesn't add one.
  - Then add indexes for whatever the finished admin screens (Orders queue, Calendar, Messages) filter or sort on that isn't covered, and check the busiest queries with `EXPLAIN ANALYZE` against production-sized data.

### Links & navigation
- [ ] **Every nav and footer link**: checked in headless runs (Services, Gallery, Process, About, Contact, and the Terms and Privacy PDFs). Do a full manual pass.
- [ ] **Broken links and 404s across every page**: only the nav and footer have been checked. Crawl the production site (every page, including in-page links, buttons, images and the legal PDFs) with a link checker, e.g. `npx linkinator https://atunse-five.vercel.app --recurse`, and fix anything that answers 404 or errors. Re-run after the custom domain is live.
- [ ] **Refund Policy and Cookie Policy links**: don't exist yet (see Legal).
- [x] **No links to placeholders**: nothing on the site links to `/coming-soon` any more.
- [x] **Logo returns to the homepage** (`SiteNav` brand links to `/`).
- [ ] **Custom 404 page**: missing today is Next's default, unstyled "404: This page could not be found."

### Production & operations
- [ ] **Production database**: Neon, set through Vercel; confirm the Neon Vercel integration (entry above).
- [ ] **Database backups**: confirm Neon's point-in-time restore and retention window on the current plan.
- [ ] **Domain and DNS**: production is only `atunse-five.vercel.app`. When a custom domain is added, also add it to the photo bucket's CORS (entry above).
- [x] **SSL certificate**: Vercel-managed and valid on `atunse-five.vercel.app` (HTTPS verified); a custom domain gets one automatically.
- [ ] **Error monitoring and logging**: none (only Vercel's own logs). Add one (e.g. Sentry) before launch.
- [ ] **Transactional email provider and sender authentication**: Resend isn't configured (entry above); verifying the sending domain in Resend sets up SPF and DKIM.
- [ ] **Uptime monitoring**: none.
- [ ] **Remove test accounts and data**: production may still hold smoke-test Orders (see "Legacy orders with a blank `contactPhone`" above). Check for them, and any test Customer Accounts, and remove them before launch.
- [x] **No debug logging**: the only log output is the console email fallback, which masks recipients and hides subjects in production.
- [x] **No development-only endpoints**: the local-storage upload route (`/api/v1/uploads/local`) refuses to run in production.
- [ ] **Analytics**: none. Decide; adding it means updating the Privacy Policy and the cookie decision above.
- [ ] **Production environment variables**: the full list is in `docs/DEPLOYMENT.md`; still missing are Resend, `CONTACT_EMAIL` and Zelle (entries above).
- [ ] **Final production smoke test** (below).

### Final launch test (manual, on production, desktop then mobile)
- [ ] Visit the homepage as a new customer.
- [ ] Browse services and pricing.
- [ ] Start a booking.
- [ ] Select services and add-ons.
- [ ] Review and edit the order.
- [ ] Accept the required agreements.
- [ ] Complete checkout. *Today: the booking submits and shows Zelle deposit instructions; there's no online payment.*
- [ ] Confirm payment. *Today: the owner marks the Zelle deposit received; that admin screen isn't built yet.*
- [ ] Confirm the booking appears in the customer's account. *Needs "My bookings".*
- [ ] Confirm the customer receives the confirmation email. *Needs Resend.*
- [ ] Confirm the booking appears in the admin dashboard. *Needs the Orders queue (blocker above).*
- [ ] Test admin actions on the booking.
- [ ] Test the cancellation and refund path.
- [ ] Repeat the critical flow on mobile.

## Admin Overview: replace sample data and placeholders with real data

The Overview (`/admin`, design `scratch/overview-dashboard.jpeg`) shows sample data where nothing records the real thing yet. Sample figures live in `src/features/admin-overview/sample-data.ts`, are marked `TODO(sample-data)`, and carry a dashed "Sample" tag on the page. Delete each one as its real source lands.

**Sample data (shown now, not real):**
- [ ] **Unread Messages** count (`SAMPLE_UNREAD_MESSAGES`): count CUSTOMER Messages with `readAt` null in Conversations that aren't archived. Needs the Conversation/Message tables (#119), then the Messages screen to mark them read.
- [ ] **Low Stock Items** count (`SAMPLE_LOW_STOCK_ITEMS`): count active Inventory Items with `stock <= lowStockAt`. Needs the InventoryItem table (#119), then the Inventory screen to enter stock.
- [ ] **Recent Reviews** (`SAMPLE_REVIEWS`): decide where reviews come from (customers after Completed, or imported from Google/Instagram), add a Review model, then show the latest.

**Placeholders (real data exists, but the design shows more):**
- [ ] **Pending Payments: Zelle/Cash split.** On #119's branch it's live (Payment rows); lands when #119 merges.
- [ ] **Order #: ATU-1008 numbers** instead of the 8-character reference. On #119's branch; lands when #119 merges.
- [ ] **Today's Schedule: return drop-offs.** Only collections show today; show RETURN Appointments too (#119), once Order detail or the Calendar can book one.
- [ ] **"Revenue" as payments received** rather than booked estimates, once payments are confirmed through Payment rows (#119 + the Payments screen).
- [ ] **Links:** "View all orders", "View orders", "View calendar", "View all" (Needs Attention, Reviews) and the Recent Orders row "…" menu appear once their screens exist (`builtScreenHref` in `src/app/admin/admin-screens.ts`).
- [ ] **Notification bell** in the top bar: needs something to notify about (new bookings, customer messages).
- [ ] **Per-chart range dropdowns** ("This Week" on each chart in the design): today one range picker scopes the whole page, so the numbers always agree. Revisit only if DJ wants charts on different ranges.
- [ ] **Brand panel photo:** a 180×198 crop of the design image (`public/images/admin/brand-sneaker.jpg`), soft on retina screens. Replace with a proper photo.
- [ ] **Search** in the top bar: enable with the Orders screen, which it searches.

## Housekeeping
- [x] Before/After section used to fake a side-by-side split with CSS on one stacked photo — real, separate before/after image pairs now exist in both `scratch/landing-mock.html` and `public/images/landing/` (Services grid also swapped to real category photos).
- [x] `/booking`'s contact step now checks email and US phone format with the same rules `submitOrder` enforces server-side (`src/features/booking/contact-rules.ts`).
- [x] Dependency security alerts: upgraded to Next 16 / React 19 / Node 24 LTS (Next 16 ships the patched PostCSS; Vitest 5, tsx and ESLint 9 cover the dev-tooling advisories).
- [ ] Deploys currently run through Vercel's native Git integration (Production Branch = `main`), not through `release.yml`. Gate production behind the `v*` tag `Release` creates instead once there's a real reason to (manual approval gate, stricter control than "Production Branch = main" gives) — full removal/rewire steps in `docs/DEPLOYMENT.md`'s "Future: gate deploys through git-flow" section.
- [ ] Confirm the Neon Vercel integration (not just a pasted `DATABASE_URL`) is installed so Preview deployments get an isolated database branch instead of sharing one — see `docs/DEPLOYMENT.md`.
- [x] Landing page CTAs used to be inert placeholders. Every "Book Now" CTA now links to `/booking`.
- [x] **Connect `/booking` to the real order submission** — single pair only. Confirm Booking uploads photos (presigned, ADR-0004) and submits to `POST /api/v1/orders`. Schema, API and `submitOrder` now take Fulfillment Method, address, collection date/slot, mail-in date, Services, material, Rush and contact name. Prices moved server-side (`service-catalog.ts`) with a parity test against `services-data.ts`. The Review step has a real Policy Acceptance checkbox, and the confirmation shows the Deposit and Zelle instructions.
- [x] **Photo storage in production.** Verified 2026-09-28: production (`atunse-five.vercel.app`) issues upload targets on the Neon bucket `atunse-images` (201), and a real browser upload from the site succeeds (204). The bucket's CORS is locked down (see below).
- [ ] **Launch blocker: set `ZELLE_RECIPIENT`/`ZELLE_NAME`** in Vercel. Without them, customers are told payment instructions will follow by email, and nobody sends that email yet.
- [x] **Legal PDFs** (both version 2026-09-27-v1) ship at permanent versioned URLs, `public/legal/terms/` and `public/legal/privacy/`: the Terms of Service & Restoration Agreement (linked from the booking's Terms Agreement checkbox) and the Privacy Policy (linked from the booking Review step), both also in the footer. To publish a new version, add a new file (never overwrite one) and update `src/shared/legal-documents.ts`; see `public/legal/README.txt`.
- [x] **Terms acceptance evidence** (ADR-0015): every Order records the agreement version, URL and SHA-256 it accepted, each acknowledgment, and when.
- [ ] **Before launch: final legal review of both PDFs.** Their last pages still carry drafting notes meant for the owner, not customers. The Terms has a "Website Acceptance / Recommended checkout language" section and a "Legal notice: This document is a business-oriented template…". The Privacy Policy has an "Implementation note" (verify the payment processor, analytics, pixels, email/SMS, hosting/database and cookie technologies actually in use), the same "Legal notice", and says "Before launch, Atunse should ensure that the website displays a monitored contact method for privacy requests". Have counsel review them, then publish versions without those notes. Both also still say **"pickup"** (the Terms' section 11 "Pickup, Delivery and Shipping" and section 14's "arranging pickup, delivery, or shipment"; the Privacy Policy's "pickup details" and "pickup, delivery, and shipping information"): update them to Local Drop-Off (DJ collects and drops back off) and Mail-In when they're revised.
- [x] **Contact page** (`/contact`): the contact form emails the shop's inbox with Reply-To set to the customer; linked from the nav, footer and booking summary.
- [ ] **Before launch: set `CONTACT_EMAIL` to a monitored inbox** (with Resend configured), or the contact form answers "unavailable". The Privacy Policy points customers there for privacy requests.
- [ ] Contact messages live only in the shop's inbox. If they ever need tracking (who's been answered), store them and add an admin view.
- [ ] **Where Mail-In customers ship to.** The confirmation and email say "We'll email you where to ship your pair", but nothing sends that email yet. Decide whether the shop address goes on the confirmation directly.
- [x] **Upload security hardening** (#77). Done in the app: per-IP rate limits on uploads, orders and both sign-in code routes (`src/shared/rate-limit`); every photo copied out of its upload target's reach and verified (it exists, and its bytes and stored type match its image type) before an Order is created; targets capped at the declared size and valid 5 minutes; one photo cap of 10 **per pair** on route and use-case (a Bundle carries up to 30; the server copies and checks them at most 10 at a time). Still to do by hand:
  - [x] **Apply the bucket CORS** (2026-09-28): `atunse-five.vercel.app`, `*.vercel.app` and `localhost:3000`, POST only, replacing the any-origin rule. Neon honours the `*.vercel.app` wildcard (preflight from a preview origin: 200). The previous rule is saved in `docs/storage/`; how to revert is in `docs/DEPLOYMENT.md` ("Reverting the bucket's CORS").
  - [ ] **Add the custom domain to the bucket CORS** once there is one (`docs/DEPLOYMENT.md`, "Adding an origin"), or uploads from it will fail.
  - [ ] **Clean up abandoned uploads** now and then: `STORAGE_CLEANUP_DATABASE_URL=<the database for this bucket> npm run storage:cleanup` (dry run), then add `-- --apply`. Uploads are throwaway once a booking copies them; this also removes uploads from bookings never submitted. It never reads `DATABASE_URL`, and refuses to delete if none of the database's photos are in the bucket. Could become a Vercel cron route later.
  - [ ] **Scope the storage keys** in Neon's console to this one bucket: read, write and **list**. `storage:cleanup` needs `s3:ListBucket`, and so does a clean "photo not uploaded" answer on AWS (without it, a missing object is a 403, which the app also handles).
- [ ] **Turn on GitHub's security settings** (repo admin only): Dependabot security updates, secret scanning, and push protection, all under Settings → Code security. They were off at the vulnerability scan; see `docs/DEPLOYMENT.md`.
- [ ] **Content-Security-Policy: roll out to nonce-based enforcement.** `next.config.mjs` sends it as `Content-Security-Policy-Report-Only` (vulnerability scan, #88), so browsers only log what it would block. The target state isn't just "flip it to enforcing": it's **nonce- (or hash-) based scripts with no `'unsafe-inline'`**, which is transitional debt kept only because Next's inline bootstrap has no nonce yet. Rollout:
  1. Report-Only: browse a preview (landing, services, booking with a photo upload, admin) and collect violations.
  2. Tighten sources to what's actually used.
  3. Generate a per-request nonce in `src/proxy.ts` (widen its matcher to pages), pass it to Next, and replace `'unsafe-inline'` in `script-src` with `'nonce-…' 'strict-dynamic'`.
  4. Rename the header to `Content-Security-Policy` (enforce) once a preview shows no violations.
- [ ] **HSTS preload.** HSTS is sent with `includeSubDomains` but without `preload`. Add `preload` and submit the domain at hstspreload.org only once every subdomain serves HTTPS; it's hard to undo.
- [ ] **Before turning on `FEATURE_CUSTOMER_SIGN_IN_ENABLED`:** set `RESEND_API_KEY` and `EMAIL_FROM` (a sender on a domain verified in Resend). Without them, sign-in codes only reach the server log and customers can't sign in (ADR-0014).
- [ ] **Customer "my bookings" page.** Customers can sign in (ADR-0014) and `GET /api/v1/orders/:orderId/photos` already enforces ownership, but no front-end page lists a customer's own bookings and photos yet.
- [ ] **Move admins to email sign-in codes** once Resend is live, and retire the interim admin password login (ADR-0005 addendum).
- [ ] **Legacy orders with a blank `contactPhone`.** The ADR-0014 migration marked pre-booking-flow smoke-test orders that had no phone with `''`. Check production for any before launch.
- [x] **Landing booking panel copy** now matches the catalog and ADR-0010 (#105): prices come from `SERVICE_CATALOG`, no prepaid-label promise, and the local tab is "Local Drop-Off".
- [ ] **Release back-merge PR can't be opened automatically.** `release.yml`'s `back-merge-to-develop` job pushes `chore/back-merge-<sha>`, but `gh pr create` fails with "GitHub Actions is not permitted to create or approve pull requests" (repo setting is off). Turning the setting on isn't enough: PRs opened with `GITHUB_TOKEN` don't trigger CI, and `develop` requires the `test` check. Fix by giving the job a fine-grained PAT secret (Contents + Pull requests write) for `gh pr create`, or have the job print a compare link for a manual PR instead of failing. Pending now: `chore/back-merge-ce98fe9` (0.2.2 `package.json` bump) needs a manual PR into `develop`.

## Client feedback — landing page & booking flow (2026-09-26)
Raw feedback checked against current code. Items already done or already
tracked elsewhere are marked; everything else is new.

- [x] **Separate cleaning vs. restoration turnaround messaging.** Services page shows its own badge on Cleaning ("Typically 72 hours") and Restoration ("Typically 5–10 business days"); worded as estimates since #106.
- [x] **"Brands we restore" list** — already matches the requested list (Nike, Jordan, Adidas, New Balance, Gucci, Prada, Dior, Balenciaga, Louis Vuitton) plus Fendi and Alexander McQueen, in `src/features/landing/brand-logos.ts`. Confirm the two extras are wanted before launch, otherwise trim to exactly the requested list.
- [x] **Brand lockup copy** — "Atunṣe" + "RESTORE & REVIVE" changed to "Atunṣe" + "POWERED BY RESTOREDBYDJ" in the nav/footer brand mark and the mock.
- [x] **Suede fee** now real — `computePricing`/`computeMultiServicePricing` in `booking-flow.tsx` adds the fee only for `suedeFee: true` services when Suede is actually selected.
- [x] **Booking flow has no way to capture contact info** (defaulted to hardcoded "John Doe" / "john@example.com") — fixed in both `scratch/landing-mock.html` and the real app: `contact-step.tsx` is a real step 4 ("Your Info"), gates Continue until name/email/phone are filled, and `ReviewStep`'s CONTACT card Edit button works again.
- [x] **Rush option** added to the contact step — confirmed flat +$20 fee, factored into `computeMultiServicePricing` in `booking-flow.tsx`.
- [x] **Photo upload is required**, not optional, in the pair-details step (`PairForm`, both the mock and the real app) — `DetailsStep`'s Continue button won't advance without at least one photo per pair.
- [x] **Before/After section shows service + price** under each result now (`before-after-carousel.tsx`'s `serviceLine`, and the mock).
- [x] **Sticky mobile "Book Now" bar** — `mobile-book-bar.tsx`, added to every marketing page except `/booking` itself.
- [x] **Social media is linked** — footer's Instagram/TikTok/YouTube icons are real `<a href>`s to `@RestoredByDJ`/`@RestoredByDj` now, in both the real app and the mock.
- [x] **CTA copy: "Book a restoration" → "Book Now."** Done in `src/features/landing/book-restoration-cta.tsx`.
- [x] **Continue-button warnings are announced by screen readers**: each step's `role="status"` warning (service, details, schedule, contact) is now always in the page and fills in when needed, so the change is announced.
- [ ] **Photo dropzone nit** (`src/features/booking/pair-form.tsx`): a drop that misses the dropzone itself still makes the browser open the file (a window-level `dragover`/`drop` guard would cover that). (The per-photo remove control this entry also asked for exists now.)

## Still to grill (architecture/design/decisions not yet interviewed)
- [x] **Return leg** (decided 2026-09-28): the local Fulfillment Method is **Local Drop-Off** (renamed from "Pickup" on the site and in the docs): DJ collects the pair at a booked time and drops it back off. Mail-In pairs are shipped back. The status reads "Ready for Drop-Off/Shipping"; code names (`PICKUP`, `READY_FOR_PICKUP_SHIPPING`, `pickupDate`) are unchanged, so no migration.
- [ ] Multi-admin/staff invite flow — access-control seam exists (ADR-0005: `admin` role, per-use-case checks), but the actual invite/onboarding UX and any role subdivision (staff vs. owner) isn't designed yet.

- [ ] Stripe integration for card/Apple Pay payments — build behind a feature toggle (off by default until ready to enable in production). Zelle/Cash manual confirmation (ADR-0002) works independently and is not gated by this toggle.
- [ ] SMS notifications (Twilio or equivalent) — build the adapter now, gate actual sending behind a feature toggle (off by default) until there's budget to pay for real sending. See ADR-0009. Email (Resend) covers all required notification events in the meantime.
- [ ] Customer data import — a dedicated admin-only screen/flow to import existing customer records, format TBD. Not an MVP-launch blocker; build once the source format is confirmed.
- [ ] Mail-in label generation via a third-party carrier API (e.g. Shippo/EasyPost) — behind the same adapter pattern as address validation. Not in MVP; MVP only captures/validates the shipping address (ADR-0010).
- [ ] Standalone cross-order messages inbox screen — behind a feature toggle. MVP messaging lives inside Item detail only; the inbox is a post-MVP admin screen.
