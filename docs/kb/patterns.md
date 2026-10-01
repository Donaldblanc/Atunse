# Patterns: copy these when adding code

Copy the nearest existing example rather than inventing a shape.

## Use-case (ADR-0003/0012): `src/features/<f>/use-cases/<verb-noun>.ts`
Example: `orders/use-cases/send-quote.ts`.
1. `export async function sendQuote(deps, actingUser, input)`.
2. Call `requireRole(actingUser, "ADMIN")` first, before reading anything.
3. Validate the input and throw a named error (`InvalidQuoteError`) carrying a user-facing message.
4. One repository call does the whole write in one transaction: the state change, the audit entry, and the idempotency key check.
5. Return a discriminated result (`{ status: "sent" } | { status: "already-sent" }`). A replay writes nothing and sends nothing.
6. Send the notification after the write succeeds. Log a failed send through `redactForLog` and report it to the caller; don't throw.
7. Tests go in `<name>.test.ts` against the in-memory repository (`use-cases/test-fixtures.ts`).

## Repository method
1. Add it to the interface in `repositories/order-repository.ts`.
2. Implement it in both `prisma-order-repository.ts` and `in-memory-order-repository.ts`, keeping their behaviour identical.
3. Write a unit test through a use-case, plus an integration test in `prisma-order-repository.integration.test.ts`.
4. `PrismaClient` is imported only inside repositories (ADR-0013).

## Admin server action: `src/features/admin-overview/*-actions.ts`
Example: `updateItemStatusAction` in `order-actions.ts`.
1. Start the file with `"use server"`. Parse the `FormData` and return `{ error }` for bad input.
2. `actingUserFromCookies(await cookies())`, then `requireRole(...)` before any read.
3. Call the use-case and map its named errors to messages.
4. Finish with `revalidatePath("/admin")` or `redirect()`, and only to an `/admin` URL.
5. Each form carries an `idempotencyKey` hidden field (a UUID made when the form renders).

## Admin dialog
- Open it with a URL param on `/admin`, and build every link with `overviewHref(selection, extra)` (`overview-range.ts`) so the date range is kept.
- Use `src/shared/ui/admin-dialog.tsx` (a native `<dialog>` with `showModal()`). Closing it navigates to the URL without the param.
- Load the data on the server through an admin-only use-case. Never import Prisma into a page.
- Confirm steps must render a **different element** from the button that opened them. If the same element is reused, one click submits too (bug found in #123).

## Migration
1. Edit `prisma/schema.prisma`, then run `npx prisma migrate dev --name <snake_case>` against `atunse_dev`.
2. Add an index for any new admin filter or sort (TODO: indexes).
3. Integration runs migrate `atunse_test` themselves.

## Docs in the same PR
Update the matching `docs/kb/*` file, `CONTEXT.md` (for terms), `docs/TODO.md` (check items off and add follow-ups), and an ADR if a decision changes.
