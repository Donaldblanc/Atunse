import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { Appointment } from "@/features/orders/domain";
import type { OrderRepository } from "@/features/orders/repositories/order-repository";

/**
 * The owner marks a Collection or Return done ("Mark as Completed").
 * Only the Appointment changes: CONTEXT.md and the ADRs don't tie a
 * Collection to any pair's status, so moving pairs along the pipeline
 * (e.g. Awaiting Sneakers to In Progress) stays the owner's explicit
 * transition on Order detail. Already completed is success, so a repeated
 * click is harmless; a cancelled visit is refused (AppointmentCancelledError).
 * Admin-only (ADR-0012).
 */
export async function completeAppointment(
  deps: { orders: Pick<OrderRepository, "completeAppointment"> },
  actingUser: ActingUser,
  input: { appointmentId: string },
): Promise<Appointment> {
  requireRole(actingUser, "ADMIN");
  return deps.orders.completeAppointment(input.appointmentId);
}
