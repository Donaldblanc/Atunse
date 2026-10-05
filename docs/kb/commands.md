# Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` (Next 16, `:3000`) |
| Unit tests (all) | `npx vitest run --dir src --exclude '**/*.integration.test.ts'` |
| One test file | `npx vitest run src/features/orders/use-cases/send-quote.test.ts` |
| Integration tests | `npm run test:integration` (needs `TEST_DATABASE_URL`, a `*_test` DB) |
| Typecheck / lint | `npm run typecheck` · `npm run lint` |
| New migration | `npx prisma migrate dev --name <snake_case>` |
| Apply migrations | `npm run prisma:migrate:deploy` |
| Regenerate client | `npm run prisma:generate` |
| Seed admin account | `npm run prisma:seed` (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) |
| Create test DB (once) | `createdb -h localhost -U atunse atunse_test` |
| Abandoned uploads | `STORAGE_CLEANUP_DATABASE_URL=<db> npm run storage:cleanup` (dry run), then `-- --apply` |
| Reset local rate limits | `psql -d atunse_dev -c 'DELETE FROM rate_limit_buckets'` |
| Read-only remote query | `PGOPTIONS='-c default_transaction_read_only=on' PGCONNECT_TIMEOUT=20 psql "$URL" -w -X -c '…'` (macOS has no `timeout`) |

## Git / GitHub (see `docs/GIT_WORKFLOW.md`)
- Branch: `git fetch origin && git checkout -b feature/<name> origin/develop`
- Before every push: `gh pr view <n> --json state` (a merged PR means a new branch)
- PR: `gh pr create --base develop`
- Review threads: `gh api repos/Donaldblanc/Atunse/pulls/<n>/comments`
- Reply: `gh api -X POST …/comments/<id>/replies -f body=…`
- Resolve threads with the GraphQL `resolveReviewThread` mutation, only after the fix is verified.

## The owner runs these themselves (no model tokens)
Plain `git push`, `npm test`, `npm run dev`: suggest `! <command>`.
