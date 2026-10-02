import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { CompletedVisit, OrderRepository } from "@/features/orders/repositories/order-repository";

/**
 * The owner marks a Collection or Return done ("Mark as Completed").
 * The same transaction moves the Order's pairs along (planVisitMoves in
 * domain.ts): a Collection takes each approved pair in Awaiting Sneakers to
 * In Progress, a Return each pair in Ready for Drop-Off/Shipping to
 * Completed. A pair that isn't there yet, or is held on the Deposit or the
 * Balance, stays, and the result says who moved and who didn't, and why.
 * Already completed is success and changes nothing, so a repeated click is
 * harmless; a cancelled visit is refused (AppointmentCancelledError).
 * Admin-only (ADR-0012).
 */
export async function completeAppointment(
  deps: { orders: Pick<OrderRepository, "completeAppointment"> },
  actingUser: ActingUser,
  input: { appointmentId: string },
): Promise<CompletedVisit> {
  requireRole(actingUser, "ADMIN");
  return deps.orders.completeAppointment({ appointmentId: input.appointmentId, actorAccountId: actingUser.accountId });
}
