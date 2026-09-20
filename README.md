# Atunṣe

Sneaker cleaning and restoration ordering + shop-management app for
**RestoredByDJ** (NYC, serving the NY/NJ/CT Tri-State area and nationwide
mail-in). Two sides in one app: a customer-facing quote/order funnel, and
an admin panel the owner (and eventually staff) uses to run every job end
to end.

Full domain writeup, architecture decisions, and open questions live in
[`docs/SPEC.md`](docs/SPEC.md) — read that first if you're picking this up
after a break. `CONTEXT.md` is the domain glossary; `docs/adr/` holds the
individual architecture decision records; `docs/TODO.md` tracks
outstanding/deferred work.

> `demo_mock/` is a throwaway static-HTML prototype used to agree on layout
> and flow early on. It is **not** the basis for this build — see
> `demo_mock/README.md` for what it is.

## Stack
Next.js (App Router, TypeScript) · Postgres via Prisma · Vitest · deployed
to Vercel + Neon. Code is organized by feature, with layers (use-cases →
repositories → adapters) inside each feature — see
[ADR-0003](docs/adr/0003-layered-single-app-architecture.md) and
[ADR-0011](docs/adr/0011-feature-based-organization.md).

## Getting started

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL at minimum
npx prisma migrate dev --name init
npm run dev                 # http://localhost:3000
```

First-time local Postgres setup (if you don't already have one running) and
this machine's existing setup are documented in
[`docs/LOCAL_SETUP.md`](docs/LOCAL_SETUP.md).

## Common commands

```bash
npm run dev                 # start the dev server
npm run build                # production build
npm run start                # run the production build

npm run typecheck            # tsc --noEmit
npm run lint                 # eslint

npm test                     # unit tests — no database required
npm run test:integration     # repository/migration tests — needs DATABASE_URL pointed at a real Postgres

npm run prisma:generate      # regenerate the Prisma client after a schema change
npm run prisma:migrate       # create + apply a new migration (dev)
npm run prisma:migrate:deploy # apply pending migrations (CI/prod)
npm run prisma:seed          # create/update the bootstrap admin account (needs ADMIN_EMAIL/ADMIN_PASSWORD)
```

## Project layout

```
src/
  app/
    admin/                    admin landing page (guarded by middleware.ts)
    api/v1/
      orders/                 POST — customer order submission
      admin/items/[itemId]/transitions/  POST — admin-only Item status transitions
    about/page.tsx           About page — DJ's story, principles, NYC skyline mark (design: scratch/landing-mock.html, not committed)
    coming-soon/page.tsx     placeholder destination for CTAs/nav items without a real page yet
    layout.tsx               root layout
    page.tsx                 customer landing page — light default, dark toggle (design: scratch/landing-mock.html, not committed)
  middleware.ts               admin route guard — fail-closed, protected from the first deploy; delegates to features/accounts/admin-check.ts
  features/
    landing/
      gallery.ts                hero/services/before-after image keys + URL resolver (public/ now, S3/CDN once NEXT_PUBLIC_ASSETS_BASE_URL is set)
      before-after-carousel.tsx client component: split before/after cards, scroll-snap + prev/next
      brand-logos.ts             "trusted by" logo list + URL resolver (public/images/brand-logos/ now)
      brand-marquee.tsx          client component: auto-scrolling logo row, black/white swapped by theme
      site-nav.tsx               shared nav across /, /coming-soon, /about — accepts active="about" for the underlined nav state
      site-footer.tsx            shared footer, same active-state prop as site-nav
      nav-drawer.tsx             client component: mobile hamburger + slide-in drawer (hidden above 640px)
      mobile-tabbar.tsx          client component: fixed bottom tab bar simulating a native app nav (hidden above 640px)
      theme-toggle.tsx           client component: sliding light/dark switch — always defaults to light, only an explicit toggle (saved to localStorage) moves it to dark
    orders/
      domain.ts                Order/Item types, the Item status pipeline
      deps.ts                  wires the real Prisma repository + notification adapter for use-cases
      use-cases/                SubmitOrder, TransitionItemStatus, ...
      repositories/             OrderRepository interface, Prisma + in-memory implementations
    accounts/
      authz.ts                 requireRole — per-use-case authorization (ADR-0012)
      admin-check.ts            the admin-access decision (AdminCheck), unit-tested independently of the middleware runtime
    notifications/              NotificationService interface + adapters
  shared/
    money/                     Money value type (integer cents — never a float)
    db/                        Prisma client singleton
  styles/
    landing-theme.css           customer landing page design tokens (light + dark)
    admin-theme.css              admin panel design tokens

public/
  images/landing/              placeholder gallery photos (dev/local default — see gallery.ts)
  images/brand-logos/          "trusted by" logo files (dev/local default — see brand-logos.ts)

prisma/
  schema.prisma              database schema
  migrations/                 generated migrations

docs/
  SPEC.md                    consolidated project summary — start here
  TODO.md                     outstanding/deferred work
  LOCAL_SETUP.md               local Postgres + environment setup
  adr/                        architecture decision records, numbered

CONTEXT.md                    domain glossary
```

The admin panel's visual design and real authentication land in follow-up
PRs on top of this vertical slice — see `docs/SPEC.md`'s "Build sequence"
section for the phase plan.

## CI
GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, lint, unit
tests, migrations, and integration tests against a real Postgres service
container on every push/PR — see
[ADR-0007](docs/adr/0007-postgres-and-ci.md).

## Branching & releases
git-flow: `develop` is the default branch — branch `feature/*` off it, PR
back into it. `main` only moves via `release/*`/`hotfix/*` branches, tagged
automatically on merge. Both branches are protected (no direct pushes, CI
required). Full process in [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md).

## Deployment
Vercel (Production Branch `main`) + Neon, via Vercel's native Git
integration — see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for setup and
how deploys trigger.
