# TODO

## Housekeeping
- [ ] Postgres/eslint dev-tooling audit warnings (PostCSS via eslint-config-next) — transitive, dev-only, not runtime-exploitable; revisit when upgrading to Next 15/16 (breaking change, not done now).
- [ ] Deploys currently run through Vercel's native Git integration (Production Branch = `main`), not through `release.yml`. Gate production behind the `v*` tag `Release` creates instead once there's a real reason to (manual approval gate, stricter control than "Production Branch = main" gives) — full removal/rewire steps in `docs/DEPLOYMENT.md`'s "Future: gate deploys through git-flow" section.
- [ ] Confirm the Neon Vercel integration (not just a pasted `DATABASE_URL`) is installed so Preview deployments get an isolated database branch instead of sharing one — see `docs/DEPLOYMENT.md`.
- [ ] Landing page (`src/app/page.tsx`) CTAs ("Start a restoration") are inert placeholders — wire them to the real order-submission flow (presigned S3 uploads, policy acceptance, `submitOrder` use-case) once that page exists per `docs/SPEC.md`'s Phase 1 "real customer UI." Gallery photos are placeholders committed in `public/images/landing/` — swap to real restoration photos via `NEXT_PUBLIC_ASSETS_BASE_URL` once uploaded to S3 (see `src/features/landing/gallery.ts`).
- [ ] Before/After section currently fakes a side-by-side split with CSS (`background-position: top`/`bottom` on one stacked source photo). Before going live, crop the real before/after restoration photos into actual separate before/after image files (e.g. via macOS `sips` or any image editor) so the split is pixel-accurate instead of approximated.

## Still to grill (architecture/design/decisions not yet interviewed)
- [ ] Multi-admin/staff invite flow — access-control seam exists (ADR-0005: `admin` role, per-use-case checks), but the actual invite/onboarding UX and any role subdivision (staff vs. owner) isn't designed yet.

- [ ] Stripe integration for card/Apple Pay payments — build behind a feature toggle (off by default until ready to enable in production). Zelle/Cash manual confirmation (ADR-0002) works independently and is not gated by this toggle.
- [ ] SMS notifications (Twilio or equivalent) — build the adapter now, gate actual sending behind a feature toggle (off by default) until there's budget to pay for real sending. See ADR-0009. Email (Resend) covers all required notification events in the meantime.
- [ ] Customer data import — a dedicated admin-only screen/flow to import existing customer records, format TBD. Not an MVP-launch blocker; build once the source format is confirmed.
- [ ] Mail-in label generation via a third-party carrier API (e.g. Shippo/EasyPost) — behind the same adapter pattern as address validation. Not in MVP; MVP only captures/validates the shipping address (ADR-0010).
- [ ] Standalone cross-order messages inbox screen — behind a feature toggle. MVP messaging lives inside Item detail only; the inbox is a post-MVP admin screen.
