# Deployment

Current approach: **Vercel's native Git integration** (ADR-0008: Vercel +
Neon). No deploy step lives in our GitHub Actions workflows — Vercel watches
the repo directly and builds/deploys on its own. This is deliberately the
simple version first; see "Future: gate deploys through git-flow" below for
what replaces it later.

## One-time setup (do this in the Vercel dashboard)

1. **Production Branch** — Project Settings → Git → set Production Branch
   to `main` (not `develop`, which may be what Vercel picked by default at
   import time, before `main`/`develop` existed here). This is the one
   setting that actually wires Vercel into our git-flow: everything else
   (preview deploys for `develop`/`feature/*`/`release/*`/`hotfix/*`
   branches and PRs) is Vercel's default behavior, unchanged.

2. **Environment variables** — Project Settings → Environment Variables.
   Add these, matching `.env.example`:

   | Variable | Production | Preview |
   |---|---|---|
   | `DATABASE_URL` | Neon production branch connection string | Neon preview/dev branch string (see below) |
   | `SESSION_SECRET` | `openssl rand -hex 32` (unique, real secret) | same or a separate dev value |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | only needed if you run `prisma:seed` manually — not read at runtime | — |
   | `RESEND_API_KEY` / `EMAIL_FROM` | Resend API key and a sender on a verified domain; without both, emails (booking confirmations, sign-in codes) are only logged | unset, or a test key |
   | `CONTACT_EMAIL` | a **monitored** inbox for the `/contact` form (the Privacy Policy sends privacy requests there too); needs Resend configured to actually deliver. Unset: the form answers "unavailable" | unset (messages are only logged), or a test inbox |
   | `FEATURE_CUSTOMER_SIGN_IN_ENABLED` | `false` until Resend is live, then `true` (ADR-0014) | same |
   | `STORAGE_DRIVER` | `s3` (the default in production; `local` is refused) | `s3` |
   | `S3_BUCKET` | the photo bucket (Neon storage: `atunse-images`) | a separate preview bucket, or the same one |
   | `S3_REGION` or `AWS_REGION` | the bucket's region | same |
   | `S3_ENDPOINT` or `AWS_ENDPOINT_URL_S3` | only for an S3-compatible provider (Neon storage's endpoint); leave unset for AWS | same |
   | `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`, or `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | keys limited to writing (and later reading) that bucket | same |
   | `ZELLE_RECIPIENT` / `ZELLE_NAME` | the Zelle email/phone and account name customers pay the Deposit to | same or a test value |
   | `FEATURE_STRIPE_ENABLED` | `false` | `false` |
   | `FEATURE_SMS_ENABLED` | `false` | `false` |

   **Until the S3 variables are set, `/booking` can't be submitted on a
   deploy:** `POST /api/v1/uploads` answers `503` ("Photo uploads are
   temporarily unavailable"). The bucket also needs a CORS rule allowing
   `POST` from the site's origins (production domain and
   `https://*.vercel.app` for previews), since browsers upload straight to
   it with a presigned POST (ADR-0004). Keep the bucket private: no public
   read, block all public access on.

   **Bucket settings are applied by script, not by the app** (#77):
   - `STORAGE_ALLOWED_ORIGINS=https://<prod>,https://*.vercel.app,http://localhost:3000 npm run storage:configure -- --apply` restricts CORS to those origins and `POST` only. Run it without `--apply` first to see the current and proposed rules. Every `--apply` first saves the bucket's current rules to `.storage-backups/` (git-ignored) and prints the file name.

   **Current bucket CORS** (applied 2026-09-28 to `atunse-images`): origins `https://atunse-five.vercel.app`, `https://*.vercel.app` (previews: Neon honours the wildcard) and `http://localhost:3000`; method `POST` only. Checked after applying: those origins get `POST` from a preflight, `PUT`/`DELETE` and every other origin get `403`, and a real browser upload from the production site succeeded (`204`; the test object was deleted). Before this the bucket allowed any origin (`*`) with GET/PUT/POST/HEAD/DELETE; that rule is saved in `docs/storage/cors-atunse-images-before-lockdown-2026-09-28.json`.

   **Adding an origin** (e.g. a custom domain): re-run the command above with the full new list; it replaces the rule, and the old one is backed up first. Until the custom domain is added, photo uploads from it fail in the browser.

   **Reverting the bucket's CORS** (if uploads break after a change):
   1. Dry run, to see what would be restored: `npm run storage:configure -- --restore docs/storage/cors-atunse-images-before-lockdown-2026-09-28.json` (or any file in `.storage-backups/`).
   2. Restore: add `--apply` to the same command. It backs up the rules it replaces, writes the saved ones, and prints what the bucket now has. A backup of "no rules" removes the CORS configuration entirely.
   3. Check with a preflight: `curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS <S3 endpoint>/<bucket> -H "Origin: https://atunse-five.vercel.app" -H "Access-Control-Request-Method: POST"` should print `200`.

   The script refuses a backup made for a different bucket. It uses the storage credentials in `.env` (currently the production bucket), so check which bucket the dry run names before adding `--apply`.

   CORS is defence in depth here, not the lock on the bucket: the bucket is private, and every upload needs a presigned POST that only `POST /api/v1/uploads` issues (rate-limited, 5-minute expiry, size and type pinned). CORS decides which web pages' scripts may talk to the bucket and read its answers.
   - `STORAGE_CLEANUP_DATABASE_URL=<database for this bucket> npm run storage:cleanup` lists photos older than 48 hours that no order references; add `-- --apply` to delete them. The database must be given explicitly (it never falls back to `DATABASE_URL`), and deletion is refused if none of the database's photos are in the bucket.

   **Rate limits** (per client IP, stored hashed in `rate_limit_buckets`):
   - uploads: 20 per 10 minutes;
   - orders: 10 per 10 minutes;
   - sign-in code requests: 10 per 15 minutes;
   - sign-in code guesses: 20 per 15 minutes.

   Over the limit returns 429 with `Retry-After`. Change them in `src/shared/rate-limit/rate-limiter.ts`.

   The bucket is currently **Neon's S3-compatible storage**. Its setup
   hands out the `AWS_*` names above, which the app reads as-is. Verified
   2026-09-26: presigned POST works path-style, Neon enforces the POST
   policy (oversized, wrong-type and re-keyed uploads are rejected), and
   anonymous GET/LIST return 403.

3. **Connect Neon properly** — if you haven't already, install the
   [Neon Vercel integration](https://vercel.com/integrations/neon) instead
   of pasting a static `DATABASE_URL`. It auto-injects `DATABASE_URL` **and**
   creates an isolated Neon database branch per Vercel Preview deployment,
   so preview builds never touch production data and PRs get a disposable
   database automatically. Without it, all Preview deploys share whatever
   single `DATABASE_URL` you set manually.

4. **Build command** — no override needed. `npm run build` now runs
   `prisma generate && prisma migrate deploy && next build`, so every
   deploy (production or preview) applies pending migrations to whichever
   database its `DATABASE_URL` points at before building.

## Repository security settings (GitHub → Settings → Code security)
These are GitHub settings, not files, so a repo admin has to turn them on.
All three were off at the vulnerability scan. Checked 2026-10-01: secret
scanning is on; the other two are still off (`docs/TODO.md`, Housekeeping).
- **Dependabot security updates** (off): `.github/dependabot.yml` already
  schedules weekly npm and Actions updates into `develop`; turning this on
  adds immediate PRs for security advisories.
- **Secret scanning** (on) and **push protection** (off): push protection
  blocks a commit that contains a recognisable secret (API keys, database
  URLs) before it reaches GitHub.

Workflows pin every action to a full commit SHA (with the version in a
comment), so a moved tag can't change what runs with the repo's token.
Dependabot's `github-actions` updates keep the pins current.

## Rolling out the security hardening (PR #88)
**Expected side effects (one-time).** Every key is now HKDF-derived from
`SESSION_SECRET` per purpose (`atunse/<purpose>/v1`), so on the first
deploy:
- everyone is signed out, admins and customers;
- sign-in codes still in flight stop working (request a new one);
- rate-limit counters start fresh;
- local upload links (dev only) change.

Deploys also fail closed if `SESSION_SECRET` is missing, shorter than 32
characters or a placeholder: check the Vercel value first
(`openssl rand -hex 32`).

**Order.**
1. **Preview first.** Deploy the PR to a Vercel preview and run the full
   automated suite (`npm test`, `npm run test:integration`, `tsc`,
   `eslint`, `next build`, `npm audit`), all on Node 24.
2. **Manual abuse checks on the preview:**
   - 11 bad admin sign-ins from one IP: the 11th gets 429 with Retry-After.
   - Repeated attempts on one email from several IPs: the 21st gets 429.
   - `atunse_session=x.!!!` on `/admin` redirects; it doesn't 500.
   - `/admin` and `/api/v1/admin/*` without an admin session are refused.
   - Timing: compare the median of ~10 known-email and ~10 unknown-email
     wrong-password attempts. They should be within noise. This is an
     observation, not a CI assertion.
3. **CSP:** browse landing, services, booking (with a photo upload) and
   admin with the console open, and note any
   `Content-Security-Policy-Report-Only` violations.
4. **Normal flows:** admin sign-in, a single-pair and a Bundle booking with
   photos, customer email-code sign-in (if enabled), and sign-out.
5. **Production.** Then monitor the logs for a day:
   - authentication failures (401 on `/api/v1/auth/*`);
   - 429s, which should be rare for real users;
   - unexpected 401/403 on admin or photo routes;
   - any 5xx.

   Straight after the deploy, check admin sign-in and a booking with a
   photo upload.

**Rollback.** Use Vercel "Instant Rollback" to the previous deployment.
#88 has no database migration, so the schema is untouched and nothing
needs reverting in Neon. Rolling back swaps keys a second time, so
everyone is signed out again and rate-limit counters restart. The
`rate_limit_buckets` rows written in the meantime are harmless (they age
out).

## Triggering a deploy

With the integration connected, you don't run anything manually:

- **Push to any branch / open or update a PR** → Vercel builds a Preview
  deployment automatically, comments the URL on the PR.
- **Merge to `main`** (i.e., a `release/*` or `hotfix/*` PR landing, per
  `docs/GIT_WORKFLOW.md`) → Vercel builds and promotes to Production
  automatically.

To trigger one without a new commit (e.g. to re-run after changing an env
var): Vercel dashboard → Deployments → select a deployment → **Redeploy**.
Or, with the Vercel CLI installed and logged in (`vercel login`):

```bash
vercel                # deploy the current directory as a Preview
vercel --prod          # force a Production deployment
```

## Future: gate deploys through git-flow (not done yet)

Deferred by explicit choice (see `docs/TODO.md`) — Vercel's native
integration is simpler and was chosen to get deploys working today. Revisit
once there's a real reason to gate production strictly behind the `v*` tag
`release.yml` creates (e.g. a required manual-approval step, or Production
deploys firing on branches other than `main` today, which the native
integration can't prevent on its own beyond the Production Branch setting).

If/when that's worth doing:

1. **Remove the automatic trigger** — Vercel dashboard → Project Settings →
   Git → disconnect the GitHub integration (or, less drastically, turn off
   "Automatically deploy" — check current Vercel docs, this setting has
   moved before). This stops Vercel from building on every push.
2. **Add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`** as repo
   secrets (Account Settings → Tokens for the token; `.vercel/project.json`
   after running `vercel link` locally for the other two).
3. **Add a deploy step to `.github/workflows/release.yml`**, after
   `tag-release` succeeds — something like:
   ```yaml
   - uses: amondnet/vercel-action@v25
     with:
       vercel-token: ${{ secrets.VERCEL_TOKEN }}
       vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
       vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
       vercel-args: '--prod'
   ```
4. **Keep Preview deploys on Vercel's own integration** if you still want
   per-PR preview URLs — only Production needs to move behind the tag; or
   also gate previews through a `pull_request` job using `vercel-args`
   without `--prod` if you want that in Actions too.
5. Update this file and `docs/GIT_WORKFLOW.md`'s "Deployment" section once
   done — they currently describe the native-integration approach as
   current.
