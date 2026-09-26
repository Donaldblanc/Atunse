# TODO

## Housekeeping
- [x] Before/After section used to fake a side-by-side split with CSS on one stacked photo — real, separate before/after image pairs now exist in both `scratch/landing-mock.html` and `public/images/landing/` (Services grid also swapped to real category photos).
- [ ] `/booking`'s contact step (`src/features/booking/contact-step.tsx`) only validates that name/email/phone are non-empty — `type="email"`/`type="tel"` aren't enforced since there's no `<form>` submit. Add real client + server validation once a real submission flow exists.
- [ ] Postgres/eslint dev-tooling audit warnings (PostCSS via eslint-config-next) — transitive, dev-only, not runtime-exploitable; revisit when upgrading to Next 15/16 (breaking change, not done now).
- [ ] Deploys currently run through Vercel's native Git integration (Production Branch = `main`), not through `release.yml`. Gate production behind the `v*` tag `Release` creates instead once there's a real reason to (manual approval gate, stricter control than "Production Branch = main" gives) — full removal/rewire steps in `docs/DEPLOYMENT.md`'s "Future: gate deploys through git-flow" section.
- [ ] Confirm the Neon Vercel integration (not just a pasted `DATABASE_URL`) is installed so Preview deployments get an isolated database branch instead of sharing one — see `docs/DEPLOYMENT.md`.
- [x] Landing page CTAs used to be inert placeholders. Every "Book Now" CTA now links to `/booking`.
- [ ] **Connect `/booking` to the real order submission.** "Confirm Booking" (`review-step.tsx`) links to `/coming-soon`, and nothing is submitted or stored. Wiring it to `POST /api/v1/orders` / `submitOrder` needs:
  - Schema and API fields for Fulfillment Method, pickup address and date/time slot, mail-in date, selected Services and price estimate, Rush, and contact name. Today they take only one Item's brand/model/description/photo keys plus guest email/phone.
  - Presigned S3 uploads (ADR-0004) for the photos the customer picked. No `FileStorage` adapter exists yet.
  - A real Policy Acceptance checkbox on the Review step. The "By continuing, you agree…" text doesn't meet the rule `submitOrder` enforces. The Terms and Privacy links also go to `/coming-soon`.
  - Multi-item Orders for Bundles (three pairs), which the Phase 1 API doesn't support (Phase 2).
  - A decision on whether booking prices stay hard-coded in `services-data.ts` or move server-side, since the Deposit is based on them.
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
