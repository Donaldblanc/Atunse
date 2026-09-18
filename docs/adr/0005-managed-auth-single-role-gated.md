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

