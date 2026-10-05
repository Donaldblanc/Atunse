import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { OrderRepository } from "../repositories/order-repository";

/**
 * Records an Order's Balance when it should exist but doesn't: the Order
 * reached Ready for Drop-Off/Shipping before Balances were recorded, so no
 * transition created one and nothing could be marked received. Admin-only
 * (ADR-0012). Idempotent: "none" when every live pair isn't ready, nothing
 * is owed, or the Balance already exists.
 */
export async function createBalance(
  deps: { orders: Pick<OrderRepository, "ensureBalance"> },
  actingUser: ActingUser,
  input: { orderId: string },
): Promise<"created" | "none"> {
  requireRole(actingUser, "ADMIN");
  return (await deps.orders.ensureBalance(input.orderId)) ? "created" : "none";
}
