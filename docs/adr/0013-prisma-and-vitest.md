# 0013. Prisma for the database layer; Vitest for unit and integration tests

## Status
Accepted

## Context
Repositories (ADR-0003) and the Phase 0 repository/migration integration
tests (ADR-0012's build-strategy revision) need an ORM/migration tool and a
test runner picked before any schema or repository code is written.

## Decision
- **Prisma** as the ORM and migration tool against Postgres (ADR-0007). Schema lives in `prisma/schema.prisma`; `prisma migrate` generates and applies migrations; the generated `PrismaClient` is only ever imported inside repository implementations (ADR-0003/0011), never from use-cases or API routes directly.
- **Vitest** for both unit tests (use-cases, in-memory/mocked repositories) and integration tests (repositories against a real Postgres instance — a service container in CI per ADR-0007, a local Docker Postgres for development).

## Consequences
- Prisma's schema DSL is a second place (alongside TypeScript types) that models shape lives — repositories are responsible for translating between Prisma's generated types and the domain's own types (e.g. the `Money` value type from ADR-0012), so Prisma's shape never leaks past the repository boundary.
- Prisma Studio gives the owner-facing team an ad-hoc way to browse data during development without building admin screens for everything early — useful, but not a substitute for the real admin UI.
- Vitest's speed and native ESM/TS support keeps the unit-test suite (the bulk of tests, per the vertical-slice strategy) fast; the smaller integration-test suite pays the real-Postgres cost only where it's needed (repositories, migrations).
