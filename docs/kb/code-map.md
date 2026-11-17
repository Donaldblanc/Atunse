# Code map

Feature-first layout (ADR-0011): `src/features/<feature>/` holds its domain,
use-cases, repositories and UI; `src/app/` only routes into them.

## Routes (`src/app`)
| Path | What |
|---|---|
| `/`, `/services`, `/process`, `/about`, `/contact`, `/booking`, `/coming-soon` | customer pages (`page.tsx` each) |
| `/admin` | admin Overview; dialogs via URL params (`?order=`, `?visit=`, `?metric=`, `?attention=`, `?range=`) |
| `/admin/customers`, `/admin/customers/[id]` | Customers list and detail (contact info + order history) |
| `/admin/inventory` | Inventory: stat cards, filtered table, item panel (`?item=`, `?tab=`), Add Item dialog (`?new=1`) |
| `/account` | My bookings: a signed-in customer's own Orders (flag-gated, never cached) |
| `robots.ts`, `sitemap.ts`, `icon.svg`, `not-found.tsx` | robots.txt, sitemap, favicon, the site's 404 |
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
| `orders` | `domain.ts` (statuses, `canTransition`, `adminStatusMoves`) · `use-cases/*` · `repositories/{order-repository,prisma-…,in-memory-…}.ts` · `service-catalog.ts` (pure pricing over a `Catalog` argument; the data comes from the database) · `default-catalog.ts` (tests only) · `status-emails.ts`, `visit-emails.ts` · `pickup-window.ts` (collection slots from Settings' operating hours) · `deps.ts` (wiring) |
| `admin-overview` | `get-admin-overview.ts` (page data) · `panels/` (one component per Overview panel) · `dialogs/` (one slot per dialog + `registry.tsx`) · `*-dialog.tsx` · `*-actions.ts` (server actions) · `overview-range.ts` (`overviewHref`) · `sample-data.ts` |
| `booking` | `booking-flow.tsx` (steps + client pricing) · `*-step.tsx` · `site-data-context.tsx` (`useSiteData()`: the catalog and Settings the page loaded) · `services-data.ts` (icons and copy per Service id) · `submit-booking.ts` |
| `accounts` | `authz.ts` (`requireRole`) · `admin-check.ts` · `session.ts`, `password.ts` · sign-in code use-cases |
| `inventory` | `use-cases/*` (list, get, save, suppliers, adjust-stock, images; admin-only) · `repositories/` · `inventory-actions.ts` (server actions) · `inventory-form.ts` (form parsing, error messages) · `inventory-href.ts` (every screen link) · `inventory-{table,panel,item-form,stock-form,…}.tsx` · `inventory-screen.css` (`inv-`) |
| `admin-customers` | `list-customers.ts`, `customer-detail.ts` (Customers list/detail use-cases) · `deps.ts` |
| `notifications` | `notification-service.ts` (interface + console logger) · `resend-notification-service.ts` · `index.ts` picks one from env |
| `services`, `settings` | admin screens' use-cases and repositories · `services/site-catalog.ts` (`loadCatalog`) and `settings/site-settings.ts` (`loadSiteSettings`): what the customer site reads |
| `account` | My bookings UI (`account-sign-in.tsx`, `my-bookings.css`); the use-case is `orders/use-cases/list-my-orders.ts` |
| `landing`, `contact` | marketing components; contact form use-case |

## Shared (`src/shared`)
`money/` (integer cents) · `db/prisma-client.ts` · `storage/` (S3 + local `FileStorage`) ·
`rate-limit/` · `logging/redact.ts` · `ui/admin-dialog.tsx` (native `<dialog>`) ·
`site/` (`siteUrl`, `pageMetadata`) · `testing/` (test-db guard, `deleteAllOrders`) · `legal-documents.ts` · `config/`

## Elsewhere
`prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts` (admin account) ·
`design-system/atunse-admin/MASTER.md` (admin UI tokens) · `scratch/` (design images, not shipped) ·
`demo_mock/` (old prototype, ignore) · `public/legal/` (versioned PDFs)
