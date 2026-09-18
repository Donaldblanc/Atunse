# Local setup

## Prerequisites
- Node 20+
- Postgres 14+ (local, for dev/integration tests — CI uses a service container, ADR-0007)

## First-time setup
```bash
npm install
cp .env.example .env   # fill in DATABASE_URL at minimum
npx prisma migrate dev --name init
npm run prisma:generate
```

## This machine's local Postgres (already set up)
Installed via Homebrew (`postgresql@14`), running as a background service:
```bash
brew services start postgresql@14   # already running
brew services stop postgresql@14    # to stop it
```
App DB user/database created:
```
user: atunse / password: atunse
database: atunse_dev
```
Matches `DATABASE_URL` in `.env.example`.

## Common commands
```bash
npm run dev              # Next.js dev server
npm run typecheck
npm run lint
npm test                 # unit tests (no DB required)
npm run test:integration # repository/migration tests — needs DATABASE_URL pointed at a real Postgres
npm run build
```

## Verified working (this session)
- `npm install`, `tsc --noEmit`, `eslint`, `next build` — all clean
- `prisma migrate dev` applied the first migration successfully

Feature code, API routes, and admin auth each add their own verified-working
notes in their own PRs — see `docs/SPEC.md`'s "Build sequence" section.
