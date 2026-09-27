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
   - `STORAGE_ALLOWED_ORIGINS=https://<prod>,https://*.vercel.app,http://localhost:3000 npm run storage:configure -- --apply` restricts CORS to those origins and `POST` only. Run it without `--apply` first to see the current and proposed rules.
   - `npm run storage:cleanup` lists uploads older than 48 hours that no order references; add `-- --apply` to delete them. Point `DATABASE_URL` at the database that goes with the bucket.

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
