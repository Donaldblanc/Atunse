# 0005. Managed auth provider, single system, role-based access

## Status
Accepted

## Context
Two very different populations need to authenticate: many casual/guest-capable
customers, and a small number of trusted staff. Today that's just the owner,
but the business explicitly wants multiple staff accounts with distinct
roles eventually. Building password hashing, sessions, verification, and
reset flows in-house is real security surface for a small team to own.

## Decision
Use a managed auth provider (e.g. Clerk/Auth0/Supabase Auth — exact choice
TBD) rather than building auth in-house. One auth system for both
populations, with a `role` on each account. Every admin-only use-case checks
role server-side per ADR-0003, never client-side.

**MVP role set:** `customer` and `admin`. `admin` is a single blanket role —
any admin account can do everything in the admin panel (view/edit orders,
update statuses, quote, message, upload files, mark payments received,
import customer data). No permission subdivision within `admin` yet.

**Route access is strictly partitioned by role:** a `customer` account can
only reach customer-facing routes (their own orders, account, signup/order
flow) — every other route (admin panel, including a future customer-data
import screen) is `admin`-only and rejected server-side for a `customer`
session, not just hidden in the UI.

**Designed for growth:** role checks are written per-use-case (e.g.
`requireRole(user, 'admin')`) rather than scattered ad-hoc, so introducing
narrower roles later (e.g. `staff` limited to status updates and messaging,
`admin` retaining owner-only actions like payments or user management) is a
matter of splitting the role check on individual use-cases — not a rearchitecture.

## Consequences
- Password security, session handling, and reset-flow email delivery are the provider's problem, not ours.
- Vendor dependency and per-user/seat cost enters the stack.
- A single user table simplifies guest→account linking (email/phone matching against one Customer record) but means customer-facing and admin auth share infrastructure — mitigated by strict server-side role checks, not by system separation.
- Multi-admin support (inviting staff, assigning roles) is an MVP-adjacent feature to schedule, but the access-control seam for it exists from day one.

## Addendum (interim bootstrap, still Accepted)
Building admin screens requires *something* real behind the sign-in page
before a managed provider is chosen — an open or fake-authenticated admin
panel isn't acceptable even temporarily (per the vertical-slice build
philosophy: protect the admin interface from the first deployment).

So, as an interim step:
- `Account.passwordHash` stores a scrypt hash (Node's built-in `crypto`, no
  new dependency) — see `src/features/accounts/password.ts`.
- Credential verification sits behind an `AuthService` interface
  (`src/features/accounts/auth-service.ts`), matching the adapter pattern
  used for storage/notifications (ADR-0003/0004) — swapping in a managed
  provider later means implementing this interface differently, not
  rewriting callers.
- A session is a small JSON payload (`accountId`, `role`, `exp`) signed with
  HMAC-SHA256 via Web Crypto (`src/features/accounts/session.ts`) and
  carried in an `httpOnly`, `sameSite=lax` cookie. Web Crypto (not
  `node:crypto`) specifically because `checkAdminAccess` is imported by
  `src/middleware.ts`, which runs on Next's Edge runtime.
- `POST /api/v1/auth/sign-in` / `POST /api/v1/auth/sign-out` issue and clear
  that cookie. `checkAdminAccess` verifies it — still fails closed on
  anything missing, expired, or tampered, exactly as before.
- The one bootstrap admin account is created by `npm run prisma:seed`
  (`prisma/seed.ts`), which requires `ADMIN_EMAIL`/`ADMIN_PASSWORD` in the
  environment and refuses to run without them.

This is explicitly a bridge, not a reversal of the managed-provider
decision above: no password-reset flow, no email verification, no rate
limiting on sign-in attempts. Replace it once a provider is chosen.
