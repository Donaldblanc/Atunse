# Code map

Feature-first layout (ADR-0011): `src/features/<feature>/` holds its domain,
use-cases, repositories and UI; `src/app/` only routes into them.

## Routes (`src/app`)
| Path | What |
|---|---|
| `/`, `/services`, `/process`, `/about`, `/contact`, `/booking`, `/coming-soon` | customer pages (`page.tsx` each) |
| `/admin` | admin Overview; dialogs via URL params (`?order=`, `?visit=`, `?metric=`, `?attention=`, `?range=`) |
| `/sign-in` | interim admin password sign-in (ADR-0005 addendum) |
| `api/v1/orders` (+ `[orderId]/photos`) | booking submit · 5-minute photo view links |
| `api/v1/uploads` (+ `local`) | presigned upload targets · dev-only local upload sink |
| `api/v1/admin/items/[itemId]/transitions` | admin Item status moves (same rules as the dialogs) |
| `api/v1/auth/{sign-in,sign-out,code/request,code/verify,customer/sign-out}` | admin and customer auth |
| `api/v1/contact` | contact form → shop inbox |
| `src/proxy.ts` | Next 16's request proxy (was `middleware.ts`): fails closed on `/admin*` and `/api/v1/admin*` |

## Features (`src/features`)
| Feature | Key files |
|---|---|
| `orders` | `domain.ts` (statuses, `canTransition`, `adminStatusMoves`) · `use-cases/*` · `repositories/{order-repository,prisma-…,in-memory-…}.ts` · `service-catalog.ts` (server prices) · `status-emails.ts`, `visit-emails.ts` · `pickup-window.ts` (collection slots) · `deps.ts` (wiring) |
| `admin-overview` | `get-admin-overview.ts` (page data) · `panels/` (one component per Overview panel) · `dialogs/` (one slot per dialog + `registry.tsx`) · `*-dialog.tsx` · `*-actions.ts` (server actions) · `overview-range.ts` (`overviewHref`) · `sample-data.ts` |
| `booking` | `booking-flow.tsx` (steps + client pricing) · `*-step.tsx` · `services-data.ts` (display prices, parity-tested against `service-catalog.ts`) · `submit-booking.ts` |
| `accounts` | `authz.ts` (`requireRole`) · `admin-check.ts` · `session.ts`, `password.ts` · sign-in code use-cases |
| `notifications` | `notification-service.ts` (interface + console logger) · `resend-notification-service.ts` · `index.ts` picks one from env |
| `landing`, `contact` | marketing components; contact form use-case |

## Shared (`src/shared`)
`money/` (integer cents) · `db/prisma-client.ts` · `storage/` (S3 + local `FileStorage`) ·
`rate-limit/` · `logging/redact.ts` · `ui/admin-dialog.tsx` (native `<dialog>`) ·
`testing/` (test-db guard, `deleteAllOrders`) · `legal-documents.ts` · `config/`

## Elsewhere
`prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts` (admin account) ·
`design-system/atunse-admin/MASTER.md` (admin UI tokens) · `scratch/` (design images, not shipped) ·
`demo_mock/` (old prototype, ignore) · `public/legal/` (versioned PDFs)
