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
   | `RESEND_API_KEY` | leave unset until ADR-0006's provider is actually wired; `ConsoleNotificationService` is still what's used today | — |
   | `FEATURE_STRIPE_ENABLED` | `false` | `false` |
   | `FEATURE_SMS_ENABLED` | `false` | `false` |

   `S3_*` variables aren't needed yet — presigned uploads aren't built (see
   `docs/SPEC.md` build sequence).

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
