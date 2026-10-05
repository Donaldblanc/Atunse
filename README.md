# Atunṣe

Sneaker cleaning and restoration ordering + shop-management app for
**RestoredByDJ** (NYC, serving the NY/NJ/CT Tri-State area and nationwide
mail-in). Two sides in one app: a customer-facing quote/order funnel, and
an admin panel the owner (and eventually staff) uses to run every job end
to end.

Picking this up after a break? Start at [`docs/kb/README.md`](docs/kb/README.md),
a short index of task-sized notes. The full domain writeup, architecture
decisions and open questions live in [`docs/SPEC.md`](docs/SPEC.md). `CONTEXT.md` is the domain glossary; `docs/adr/` holds the
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
npm run test:integration     # repository/migration tests — needs TEST_DATABASE_URL (a *_test database; docs/LOCAL_SETUP.md)

npm run prisma:generate      # regenerate the Prisma client after a schema change
npm run prisma:migrate       # create + apply a new migration (dev)
npm run prisma:migrate:deploy # apply pending migrations (CI/prod)
npm run prisma:seed          # create/update the bootstrap admin account (needs ADMIN_EMAIL/ADMIN_PASSWORD)
```

## Project layout
Feature-first (ADR-0011): each feature in `src/features/<name>/` holds its
domain, use-cases, repositories and UI; `src/app/` only routes into them.

```
src/app/        routes: customer pages, /admin, /sign-in, /api/v1/*
src/proxy.ts    request guard (Next 16's middleware): /admin and admin APIs fail closed
src/features/   orders, admin-overview, booking, accounts, notifications, landing, contact
src/shared/     money, db, storage, rate-limit, logging, ui, testing
prisma/         schema, migrations, seed (bootstrap admin)
docs/kb/        knowledge base: start here (code map, patterns, testing, gotchas)
docs/           SPEC, TODO, ADRs, setup, deployment, git workflow
CONTEXT.md      domain glossary
```

The file-level map is [`docs/kb/code-map.md`](docs/kb/code-map.md). What's
built and what's next: [`docs/kb/status.md`](docs/kb/status.md) (summary) and
`docs/SPEC.md`'s "Where the build stands" (detail).

## CI
GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, lint, unit
tests, and integration tests against a real Postgres service container
(database `atunse_test`; the test run applies migrations) on every push/PR — see
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
