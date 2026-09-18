# 0007. Postgres as the database; GitHub Actions for CI/test suite

## Status
Accepted

## Context
The domain is inherently relational (Order → Item → Service, Customer →
Account linking, Status Pipeline transitions, outbox rows) with real
consistency needs (a deposit and an Order's items should commit together).
The team needs a CI pipeline to run the test suite the layered
use-case/repository architecture (ADR-0003) is meant to make testable.

## Decision
- **Database:** Postgres. Repositories (ADR-0003) are written against it; no NoSQL store in the MVP.
- **CI:** GitHub Actions runs the test suite (and lint/typecheck) on every push/PR. Use-cases being framework-agnostic and DB access being behind repositories (ADR-0003) is what makes this suite meaningful to write and fast to run — business logic tests don't need a real Postgres instance, only repository/integration tests do.

## Consequences
- Standard, well-understood relational tooling; migrations are the normal way schema evolves.
- GitHub Actions needs a Postgres service container (or equivalent) wired up for integration tests — a small one-time CI setup cost.
- No decision yet on managed Postgres hosting provider (e.g. Supabase, Neon, RDS) — tracked as open.
