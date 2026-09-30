import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { OrderNote, OrderRepository } from "../repositories/order-repository";

export const NOTE_MAX_LENGTH = 2000;

/**
 * An admin's note on an Order (CONTEXT.md: Note: admin-only, customers never
 * see it). Admin-only (ADR-0012). The body is trimmed and must be 1 to
 * NOTE_MAX_LENGTH characters; a bad body comes back as a message, not a throw.
 *
 * Not idempotent: a Note has no key column, so a resubmit adds a second
 * one. The form clears on success and disables while sending to keep that
 * to a deliberate double add.
 */
export async function addOrderNote(
  deps: { orders: Pick<OrderRepository, "addOrderNote"> },
  actingUser: ActingUser,
  input: { orderId: string; body: string },
): Promise<{ ok: true; note: OrderNote } | { ok: false; error: string }> {
  requireRole(actingUser, "ADMIN");
  const body = input.body.trim();
  if (body.length === 0) return { ok: false, error: "Write a note first." };
  if (body.length > NOTE_MAX_LENGTH) return { ok: false, error: `Keep notes under ${NOTE_MAX_LENGTH} characters.` };
  const note = await deps.orders.addOrderNote({ orderId: input.orderId, authorAccountId: actingUser.accountId, body });
  return { ok: true, note };
}
