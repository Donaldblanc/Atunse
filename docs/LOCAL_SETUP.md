# Local setup

## Prerequisites
- Node 20+
- Postgres 14+ (local, for dev/integration tests — CI uses a service container, ADR-0007)

## First-time setup
```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npx prisma migrate dev --name init
npm run prisma:generate
npm run prisma:seed     # creates the bootstrap admin account
```

Generate `SESSION_SECRET` with `openssl rand -hex 32`. `ADMIN_EMAIL`/
`ADMIN_PASSWORD` are only read by the seed script (ADR-0005 addendum) —
sign in at `/sign-in` with them once the app is running.

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

## API surface (Phase 1)
- `POST /api/v1/orders` — customer-facing order submission (guest today; ties to an Account once auth is wired)
- `POST /api/v1/admin/items/:itemId/transitions` — every admin action on the Item pipeline (review, quote, manual payment confirmed, approve, ...), admin-only
- `POST /api/v1/auth/sign-in` — interim credential login (ADR-0005 addendum); sets the signed session cookie
- `POST /api/v1/auth/sign-out` — clears the session cookie

Both `/admin/*` pages and `/api/v1/admin/*` routes are gated by
`src/middleware.ts`, which delegates the actual decision to
`checkAdminAccess` in `src/features/accounts/admin-check.ts` — see that
file's tests (`admin-check.test.ts`, `middleware.test.ts`) for the guard's
guaranteed behavior.

## Verified working (this session)
- `npm install`, `tsc --noEmit`, `eslint`, `next build` — all clean
- 21 unit tests passing (Money, Item status pipeline, both use-cases, the admin-access check, and the middleware itself)
- 3 integration tests passing against real local Postgres, including a transactional idempotency check
- `prisma migrate dev` applied the first migration successfully
- End-to-end verified against a real running dev server + database:
  - `/admin` and `/api/v1/admin/*` both → `307` redirect to `/sign-in` (fails closed, protected from the first deployment)
  - `POST /api/v1/orders` rejects a missing policy acceptance with `400`
  - `POST /api/v1/orders` with a valid body persists a real Order + Item and returns `201`
  - `POST /api/v1/auth/sign-in` with the seeded admin's credentials sets a
    valid session cookie; that cookie then gets a real `200` from `/admin`
  - a wrong password returns `401` and sets no cookie
