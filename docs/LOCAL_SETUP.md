# Local setup

## Prerequisites
- Node 24, the active LTS (`engines.node` in `package.json`; e.g. `nvm install 24 && nvm use 24`)
- Postgres 14+ (local, for dev/integration tests — CI uses a service container, ADR-0007)

## First-time setup
```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, TEST_DATABASE_URL, SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
createdb -h localhost -U atunse atunse_test   # integration tests' own database (see below)
npx prisma migrate dev --name init
npm run prisma:generate
npm run prisma:seed     # creates the bootstrap admin account
```

Generate `SESSION_SECRET` with `openssl rand -hex 32`. It also signs the
local photo-upload targets, so `/booking` needs it too.

Booking photos use `STORAGE_DRIVER=local` by default in development: files
land in `.uploads/` (gitignored) through the dev-only
`POST /api/v1/uploads/local`, so no AWS account is needed. Set
`STORAGE_DRIVER=s3` plus the `S3_*` vars to test against a real bucket.
Set `ZELLE_RECIPIENT`/`ZELLE_NAME` to see real Deposit instructions on the
booking confirmation. `ADMIN_EMAIL`/
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
npm run test:integration # repository/migration tests — needs TEST_DATABASE_URL (see below)
npm run build
```

### Integration tests use their own database
Integration tests **delete every order and customer account** in the
database they run against, so they never use `DATABASE_URL`. They run only
against `TEST_DATABASE_URL`, whose database name must end in `_test`; the
run stops before any test if it's missing or named anything else. Create the
database once:

```bash
createdb -h localhost -U atunse atunse_test
```

and set `TEST_DATABASE_URL` in `.env` (see `.env.example`). Each run applies
pending migrations to it first. Tests also blank the S3 and Resend settings
and use local storage, so they never reach the real photo bucket or send
email.

### Rate limits in development
The public routes are rate-limited per IP (#77). Locally every request
comes from the same "local" client, so a script that books many times will
start getting 429s. Reset the counters with
`psql -d atunse_dev -c 'DELETE FROM rate_limit_buckets'`.

### Customer sign-in codes in development
Set `FEATURE_CUSTOMER_SIGN_IN_ENABLED=true` in `.env` to try the booking
flow's customer login. Without `RESEND_API_KEY`/`EMAIL_FROM`, codes aren't
emailed: the dev server log shows them as
`[notification] to=… subject="123456 is your Atunṣe sign-in code"`. The
customer session is its own cookie (`atunse_customer_session`), separate
from the admin one, so you can be signed in as both.

## API surface (Phase 1)
- `POST /api/v1/uploads` — presigned upload targets for a booking's photos (one per photo; JPEG/PNG/WebP/HEIC, under 15 MB, at most 10)
- `POST /api/v1/orders` — customer-facing order submission from `/booking`. Creates the customer's Account on their first booking (ADR-0014). Send an `Idempotency-Key: <uuid>` header to make retries safe. `409 SIGN_IN_REQUIRED` means the email already has an Account (with customer sign-in on)
- `POST /api/v1/auth/code/request`, `POST /api/v1/auth/code/verify` — customer email-code sign-in (404 unless `FEATURE_CUSTOMER_SIGN_IN_ENABLED=true`)
- `GET /api/v1/orders/:orderId/photos` — 5-minute photo view links, for the Order's owner or an admin
- `POST /api/v1/admin/items/:itemId/transitions` — every admin action on the Item pipeline (review, quote, manual payment confirmed, approve, ...), admin-only
- `POST /api/v1/auth/sign-in` — interim credential login (ADR-0005 addendum); sets the signed session cookie
- `POST /api/v1/auth/sign-out` — clears the session cookie

Both `/admin/*` pages and `/api/v1/admin/*` routes are gated by
`src/proxy.ts`, which delegates the actual decision to
`checkAdminAccess` in `src/features/accounts/admin-check.ts` — see that
file's tests (`admin-check.test.ts`, `proxy.test.ts`) for the guard's
guaranteed behavior.

## Verified working (this session)
- `npm install`, `tsc --noEmit`, `eslint`, `next build` — all clean
- 21 unit tests passing (Money, Item status pipeline, both use-cases, the admin-access check, and the proxy itself)
- 3 integration tests passing against real local Postgres, including a transactional idempotency check
- `prisma migrate dev` applied the first migration successfully
- End-to-end verified against a real running dev server + database:
  - `/admin` and `/api/v1/admin/*` both → `307` redirect to `/sign-in` (fails closed, protected from the first deployment)
  - `POST /api/v1/orders` rejects a missing policy acceptance with `400`
  - `POST /api/v1/orders` with a valid body persists a real Order + Item and returns `201`
  - `POST /api/v1/auth/sign-in` with the seeded admin's credentials sets a
    valid session cookie; that cookie then gets a real `200` from `/admin`
  - a wrong password returns `401` and sets no cookie
