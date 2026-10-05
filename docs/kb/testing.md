# Testing

## What to run (scope it: bare `vitest` also picks up `.claude/worktrees/`)
| Change | Run |
|---|---|
| any code | `npx vitest run <file-or-dir>` while working; before the PR `npx vitest run --dir src --exclude '**/*.integration.test.ts'` |
| types / lint | `npm run typecheck` · `npm run lint` |
| repository or migration | `npm run test:integration` |
| UI | one screenshot per changed screen (see Browser checks) |

## Integration tests: separate database only (#124)
- They delete every Order and customer Account, so they use `TEST_DATABASE_URL` and never `DATABASE_URL`.
- The config refuses any database whose name doesn't end in `_test`. A setup file checks `current_database()` again for each file.
- Each run migrates the test database first (`src/shared/testing/migrate-test-database.ts`).
- Locally that's `atunse_test`; CI uses `atunse_test` in a Postgres 16 container.
- Unit tests get a `DATABASE_URL` that points nowhere. Both suites force local storage and blank the S3 and Resend settings.

## Test doubles
- `InMemoryOrderRepository`: use-case tests run against it, and it must behave like the Prisma one.
- `use-cases/test-fixtures.ts`: shared builders for orders and users.
- `RecordingNotificationService` (in `test-fixtures.ts`) captures the emails a use-case sends. Outside tests, `ConsoleNotificationService` logs them when Resend isn't set up.

## Guard tests worth knowing
- `copy-rules.test.ts`: banned customer-facing claims and words, such as "pickup" and guarantees.
- `service-catalog` parity tests: client display prices must equal server prices.
- `pickup-window` integration test: booking slots must match the `operating_hours` seed.

## Browser checks (Playwright, not a repo dependency)
- Install it in your scratchpad: `npm i playwright@^1 && npx playwright install chromium`.
- Drive the dev server on `:3000`. If the owner already has `next dev` running, reuse it.
- Read the page with `page.locator("main").ariaSnapshot()` instead of taking screenshots at every step. Take one screenshot at the end.
- Save the screenshot to the scratchpad, never the repo.
- Admin sign-in uses `ADMIN_EMAIL`/`ADMIN_PASSWORD` from `.env`. Pass them as env vars and never print them.
- Booking selectors that work: `Single Pair`, `/^Premium Clean/`, `Brand / Model`, `input[type=file]`, `/^Mail-In/`, `Continue to …` buttons, every checkbox on Review, `/confirm booking/i`.
