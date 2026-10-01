# Who does what: cheap models execute, Opus plans and reviews

Subagents are defined in `.claude/agents/`, which is gitignored: they live on
the owner's machine, not in the repo. Each one starts cold, so it reads
`docs/kb/README.md` and the one file it needs, never the whole repo.

| Role | Model | Use it for | Never |
|---|---|---|---|
| **Main session** | Opus | Understand the ask, write the plan, pick agents, review their diffs, talk to the owner, commit/PR | Bulk file reading, long edits, raw test logs |
| `scout` | Haiku | "Where is X / what calls Y / which files does this touch?" Returns `path:line` + one line each | Edit anything |
| `implementer` | Sonnet | Execute a written plan: code, tests, docs for one task | Commit, push, change scope, decide architecture |
| `test-runner` | Haiku | Run typecheck/lint/unit/integration; return only failures (file, test, first error lines) | Fix code |
| `reviewer` | Opus | Independent review of the branch diff before a PR or after PR feedback; verified findings only | Edit code |

## The loop
1. **Main session plans.** It writes a plan the implementer can follow without guessing:
   - goal
   - files to touch (from `scout` if unknown)
   - the pattern to copy (`patterns.md`)
   - acceptance checks
   - out of scope
2. **`implementer` executes** and returns: files changed, a summary of each, tests added, and anything it couldn't do.
3. **`test-runner` verifies**. On failure, the main session sends the failure list back to `implementer`, not the logs.
4. **Main session reviews the diff** (`git diff --stat`, then the hunks that matter). For anything non-trivial (money, auth, migrations, status rules), it also runs `reviewer` cold.
5. **Main session commits, pushes and opens the PR** (`docs/GIT_WORKFLOW.md`). PR feedback goes back to step 2.

## When not to delegate
- The edit is under ~20 lines and the main session already has the file open. Delegating costs a cold start.
- A decision is needed: ask the owner, don't hand it to an agent.
- Truly parallel work is the only reason to run agents at the same time. Use worktrees and remove them after the merge.

## Writing a good delegation prompt
- **Say what you know.** Paths, line numbers, the example to copy. The agent can't see this conversation.
- **Give acceptance criteria as commands:** "`npx vitest run src/features/orders` passes", "no new `any`".
- **Ask for a short report.** Bullets, at most 15 lines. Raw output only for failures.
