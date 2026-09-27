# TODO

## Housekeeping
- [x] Before/After section used to fake a side-by-side split with CSS on one stacked photo — real, separate before/after image pairs now exist in both `scratch/landing-mock.html` and `public/images/landing/` (Services grid also swapped to real category photos).
- [x] `/booking`'s contact step now checks email and US phone format with the same rules `submitOrder` enforces server-side (`src/features/booking/contact-rules.ts`).
- [ ] Postgres/eslint dev-tooling audit warnings (PostCSS via eslint-config-next) — transitive, dev-only, not runtime-exploitable; revisit when upgrading to Next 15/16 (breaking change, not done now).
- [ ] Deploys currently run through Vercel's native Git integration (Production Branch = `main`), not through `release.yml`. Gate production behind the `v*` tag `Release` creates instead once there's a real reason to (manual approval gate, stricter control than "Production Branch = main" gives) — full removal/rewire steps in `docs/DEPLOYMENT.md`'s "Future: gate deploys through git-flow" section.
- [ ] Confirm the Neon Vercel integration (not just a pasted `DATABASE_URL`) is installed so Preview deployments get an isolated database branch instead of sharing one — see `docs/DEPLOYMENT.md`.
- [x] Landing page CTAs used to be inert placeholders. Every "Book Now" CTA now links to `/booking`.
- [x] **Connect `/booking` to the real order submission** — single pair only. Confirm Booking uploads photos (presigned, ADR-0004) and submits to `POST /api/v1/orders`. Schema, API and `submitOrder` now take Fulfillment Method, address, pickup date/slot, mail-in date, Services, material, Rush and contact name. Prices moved server-side (`service-catalog.ts`) with a parity test against `services-data.ts`. The Review step has a real Policy Acceptance checkbox, and the confirmation shows the Deposit and Zelle instructions.
- [ ] **Launch blocker: S3 bucket.** Create the private bucket, a CORS rule allowing `POST` from the site's origins, and an IAM user limited to it; set `STORAGE_DRIVER`/`S3_*` in Vercel (`docs/DEPLOYMENT.md`). Until then `POST /api/v1/uploads` answers 503 on every deploy and nobody can book.
- [ ] **Launch blocker: set `ZELLE_RECIPIENT`/`ZELLE_NAME`** in Vercel. Without them, customers are told payment instructions will follow by email, and nobody sends that email yet.
- [ ] **Launch blocker: real policy pages.** The Policy Acceptance checkbox asks customers to agree to a Terms of Service, Refund Policy, Restoration Disclaimer and Payment Policy that don't exist yet (links go to `/coming-soon`). Content comes from the owner.
- [ ] **Bundle submission (Phase 2).** Bundles are three Items in one Order. The Bundle Review step currently offers the single-pair flow instead of a Confirm button. Needs multi-item `submitOrder`, Bundle pricing in `service-catalog.ts`, and per-pair photo uploads.
- [ ] **Where Mail-In customers ship to.** The confirmation and email say "We'll email you where to ship your pair", but nothing sends that email yet. Decide whether the shop address goes on the confirmation directly.
- [ ] **Upload security hardening** (tracked in #77; findings from testing presigned POST against the Neon bucket, 2026-09-26). Already solid: targets are presigned POSTs, Neon enforces their policy (oversized, wrong-type and re-keyed uploads are rejected), keys are server-minted and unguessable, and anonymous GET/LIST on the bucket return 403. Open:
  - **Tighten the bucket CORS.** It allows any origin (`*`) and `GET/PUT/POST/HEAD/DELETE`. Limit it to the site's origins (production domain, preview domains, `http://localhost:3000`) and to `POST` (plus `GET` once admin views photos).
  - **Pin each target to the declared size.** `content-length-range` is the flat 15 MB cap, not the size the browser declared, so every target accepts up to 15 MB.
  - **Check what was actually uploaded.** The stored Content-Type is the label the target pins, not the bytes: a target issued for a PNG accepted JPEG bytes and stored them as `image/png`. `submitOrder` also only checks key shape, not that the object exists. Verify each key with a HEAD (size and type), and sniff magic bytes, before accepting the Order.
  - **Scope the storage keys** to this one bucket, write-only for the app (plus read for admin later), if Neon's key settings allow it.
  - **Shorter target lifetime.** 10 minutes today; a few minutes is enough for one upload batch.
- [ ] **Orphaned uploads.** Photos uploaded for a booking that's never submitted stay in storage. Add an S3 lifecycle rule (or a cleanup job) for `bookings/` objects with no Order once admin photo viewing exists.
- [ ] **Rate limiting** on the public `POST /api/v1/uploads` and `POST /api/v1/orders`.
- [ ] Remaining `/coming-soon` placeholders: the "Process" nav link, footer "Contact", and the Terms and Privacy links.

## Client feedback — landing page & booking flow (2026-09-26)
Raw feedback checked against current code. Items already done or already
tracked elsewhere are marked; everything else is new.

- [x] **Separate cleaning vs. restoration turnaround messaging.** Services page now shows its own "72-hour turnaround" badge on Cleaning and "5–10 business day turnaround" badge on Restoration.
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
- [ ] **Bundle Review step only shows the first pair.** `booking-flow.tsx` passes `pairs[0]` to `ReviewStep`, so pairs 2 and 3 (brand, material, photos, notes) are never shown for confirmation.
- [ ] **Continue-button warnings may not be announced by screen readers.** The `role="status"` warning in `contact-step.tsx`, `details-step.tsx` and `service-step.tsx` mounts together with its text on the first failed click. Render the element always (empty until needed) so the change is announced.
- [ ] **Photo dropzone nits** (`src/features/booking/pair-form.tsx`): a drop that misses the dropzone itself still makes the browser open the file (a window-level `dragover`/`drop` guard would cover that); there's also no per-photo remove control, so a wrongly picked photo can't be removed short of reloading the page and losing the whole booking.

## Still to grill (architecture/design/decisions not yet interviewed)
- [ ] **Return leg for Pickup orders.** There is no in-person drop-off (2026-09-26). Pickup and Mail-In are the only Fulfillment Methods, so decide how finished sneakers get back to a Pickup customer (return delivery? same time window as pickup?). Then rename the `READY_FOR_PICKUP_SHIPPING` Item status (`prisma/schema.prisma`, `CONTEXT.md` Status Pipeline), since "Pickup" now means the shop collecting from the customer. Needs a migration.
- [ ] Multi-admin/staff invite flow — access-control seam exists (ADR-0005: `admin` role, per-use-case checks), but the actual invite/onboarding UX and any role subdivision (staff vs. owner) isn't designed yet.

- [ ] Stripe integration for card/Apple Pay payments — build behind a feature toggle (off by default until ready to enable in production). Zelle/Cash manual confirmation (ADR-0002) works independently and is not gated by this toggle.
- [ ] SMS notifications (Twilio or equivalent) — build the adapter now, gate actual sending behind a feature toggle (off by default) until there's budget to pay for real sending. See ADR-0009. Email (Resend) covers all required notification events in the meantime.
- [ ] Customer data import — a dedicated admin-only screen/flow to import existing customer records, format TBD. Not an MVP-launch blocker; build once the source format is confirmed.
- [ ] Mail-in label generation via a third-party carrier API (e.g. Shippo/EasyPost) — behind the same adapter pattern as address validation. Not in MVP; MVP only captures/validates the shipping address (ADR-0010).
- [ ] Standalone cross-order messages inbox screen — behind a feature toggle. MVP messaging lives inside Item detail only; the inbox is a post-MVP admin screen.
