# Knowledge base

Short, task-sized notes so a session (or a cold subagent) can start work
without reading the whole repo. **Read this index, then only the one or two
files your task needs.** Each file is under ~80 lines and points to the
source of truth instead of copying it.

| File | Read it when you need… |
|---|---|
| [status.md](status.md) | what's built, what isn't, and what's next |
| [code-map.md](code-map.md) | where something lives (routes, features, shared) |
| [domain.md](domain.md) | Item statuses, code names vs. customer words, money, audit actions |
| [patterns.md](patterns.md) | how to add a use-case, repository method, admin dialog or server action |
| [testing.md](testing.md) | which tests to run, the test database, in-memory repos, browser checks |
| [commands.md](commands.md) | the exact command for dev, tests, Prisma, storage cleanup |
| [gotchas.md](gotchas.md) | traps that have already cost time (Next 16, `.env`, terminology, releases) |
| [agents.md](agents.md) | who does what: cheap agents execute, Opus plans and reviews |

## Reading rules (they keep context small)
- Don't read `docs/SPEC.md` or `docs/TODO.md` whole. `grep -n '^#' docs/TODO.md`, then read only the section you need.
- `CONTEXT.md` is the glossary: read one heading, not the file.
- ADRs: the one-line summaries are in `docs/SPEC.md` ("Architecture decisions"). Open an ADR only when changing what it decided.
- Code: find with `grep -rn` / Glob, then read the lines you need, not the file.

## Sources of truth (the KB never overrides these)
- Terms: `CONTEXT.md` · Decisions: `docs/adr/` · Outstanding work: `docs/TODO.md`
- Process: `docs/GIT_WORKFLOW.md` · Setup: `docs/LOCAL_SETUP.md` · Deploys: `docs/DEPLOYMENT.md`

## Keeping it current
A PR that changes something a KB file states updates that file in the same
PR (the reviewer checks). Update `status.md` when a PR merges a feature.
If a KB note and the code disagree, the code wins: fix the note.
