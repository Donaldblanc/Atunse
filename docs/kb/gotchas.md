# Gotchas (each one has cost a session time)

## Framework
- **Next 16, not the Next you know.** Read the guide in `node_modules/next/dist/docs/` before writing Next APIs.
- Request guarding lives in `src/proxy.ts`; Next 16 renamed `middleware.ts` to proxy.
- `next dev` re-adds a block to `AGENTS.md`. Commit it rather than fighting it.

## Environment and data
- **`.env` holds real AWS keys for the production photo bucket** (`atunse-images`). Tests force `STORAGE_DRIVER=local`. Don't run upload scripts without checking which bucket they'll hit.
- `DATABASE_URL` is the local `atunse_dev`. The Neon dev database (`atunse-dev`, which holds the real smoke-test orders) is commented out in `.env`. Query it read-only only.
- Integration tests used to wipe `atunse_dev`; since #124 they can't.
- Local order numbers jump (for example ATU-2146 was the first order after the wipe) because the sequence isn't reset.

## Words
- **Never say "pickup" to customers.** Fulfillment is **Local Drop-Off** (DJ collects and returns) or **Mail-In**. The code keeps `PICKUP` and `READY_FOR_PICKUP_SHIPPING` (`domain.md`).
- Item = one **pair**, not one shoe.

## Git and releases
- `develop` and `main` are protected: PRs only, the `test` check must pass, and the branch must be up to date. `main` only accepts `release/*` or `hotfix/*`.
- **Release back-merges don't land.** `release.yml` can't open the back-merge PR (Actions isn't allowed to create PRs), so `develop`'s `package.json` lags `main`. 5 `chore/back-merge-*` branches are waiting (TODO, Housekeeping).
- A stacked PR merged into a branch that has already merged never reaches `develop` (#123 needed #125 to land it). Retarget stacked PRs to `develop` before merging them.
- The owner merges and switches branches between turns. Check `git branch --show-current` and the PR state before committing or pushing.

## Tooling
- **Never run `npm audit fix --force`.** For the dev-only `braces` advisory it downgrades `eslint-config-next` to 14 (broken on Next 16, and it adds a vulnerable `glob`). Read `docs/TODO.md` (Housekeeping) first. Upgrades respect `~/.npmrc`'s `min-release-age=7`: install the newest version that's at least 7 days old.
- macOS has no `timeout`. Use the tool's own timeouts (`PGCONNECT_TIMEOUT`, Bash `timeout`).
- Playwright paths are relative to the cwd. Run scripts from the scratchpad so screenshots don't land in the repo.
- The `grill-me` and `grill-with-docs` skills here are empty stubs. Run the interview by hand.
- Don't run `npx prettier`. It isn't a project dependency, so npx fetches a fresh copy that rewraps whole files at 80 columns.
- Turbopack rejects a symlinked `node_modules` in a worktree. Use `next dev --webpack` there.

## Sessions and passwords
- **Admin sessions are revocable.** The signed cookie carries `sessionVersion`; `verifiedAdminSession` (`accounts/admin-check.ts`) compares it with `accounts.sessionVersion` in the database on every admin check (proxy, layout, pages, actions, API routes), so a unit test that needs a valid admin session passes a fake `AdminSessionVersions` or mocks `accounts/admin-session-versions`. Admin sign-out, a password change and an email change bump the version; the settings actions re-issue the current browser's cookie so the admin who saved stays signed in. Customer cookies carry 0 and aren't checked.
- **Cookie names are `__Host-atunse_session` and `__Host-atunse_customer_session`** (Secure, Path=/, no Domain). Only `next dev` drops the prefix and Secure, because Safari rejects Secure cookies on plain `http://localhost`. Rename = everyone signs in again once. Always use the `SESSION_COOKIE_NAME` constants, never the literal.
- **Password hashes are `scrypt$N$r$p$salt$hash`** (N=2^17, r=8, p=1, 256 MiB maxmem). The old `salt:hash` form (Node defaults) still verifies and is rehashed on a successful admin sign-in (`passwordNeedsRehash`). A hash costs ~0.2 s and ~128 MiB, so tests that hash many passwords are slower.
- **Admin JSON routes** (`/api/v1/admin/items/*/transitions`, `settings/logo-upload`) refuse a foreign `Origin` (403) and non-JSON content types (415) via `shared/http/request-guards.ts`. A missing Origin is allowed, as with Next's Server Actions.
