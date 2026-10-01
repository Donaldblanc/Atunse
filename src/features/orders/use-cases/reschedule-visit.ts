import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { NotificationService } from "@/features/notifications/notification-service";
import type { Appointment } from "../domain";
import { AppointmentNotFoundError, type OrderRepository } from "../repositories/order-repository";
import { rescheduledEmail } from "../visit-emails";
import { resolveVisitSlot, VisitSlotError } from "../visit-slot";
import { redactForLog } from "@/shared/logging/redact";

export interface RescheduleVisitDeps {
  orders: Pick<OrderRepository, "findAppointment" | "rescheduleAppointment">;
  notifications: NotificationService;
  now: () => Date;
}

export interface RescheduleVisitResult {
  appointment: Appointment;
  /** False for a replay (the visit was already at the new time): nothing changed, nothing was sent. */
  changed: boolean;
  /** Whether the customer's email went out; false when the move happened but the send failed. */
  emailed: boolean;
}

/**
 * The owner moves a SCHEDULED visit (Collection or Return) to another slot.
 * Only the Appointment changes: the Order keeps the collection time the
 * customer originally booked (CONTEXT.md, Appointment). Two visits may share
 * a slot, as booking already lets two customers pick the same one (there is
 * no capacity rule to stay consistent with). Admin-only (ADR-0012).
 *
 * Idempotent on `expectedStartsAt`, the time the owner saw when they picked:
 * the repository applies the move only from that time, so a double submit
 * or retry finds the visit already at the new time and changes and sends
 * nothing (there is no stored key to keep; see rescheduleAppointment). The
 * customer is emailed only after a real change. If the send fails the move
 * stands and `emailed` is false, so the owner can tell the customer
 * themselves; a retry won't re-send, because it no longer changes anything.
 */
export async function rescheduleVisit(
  deps: RescheduleVisitDeps,
  actingUser: ActingUser,
  input: { appointmentId: string; expectedStartsAt: Date; date: string; slot: string },
): Promise<RescheduleVisitResult> {
  requireRole(actingUser, "ADMIN");
  const target = resolveVisitSlot(input.date, input.slot, deps.now());
  if (target.startsAt.getTime() === input.expectedStartsAt.getTime()) throw new VisitSlotError("That's already this visit's time. Pick a different one.");

  const found = await deps.orders.findAppointment(input.appointmentId);
  if (!found) throw new AppointmentNotFoundError(input.appointmentId);
  const was = { startsAt: found.appointment.startsAt, endsAt: found.appointment.endsAt };

  const { appointment, changed } = await deps.orders.rescheduleAppointment({ appointmentId: input.appointmentId, expectedStartsAt: input.expectedStartsAt, ...target });
  if (!changed) return { appointment, changed, emailed: false };

  try {
    await deps.notifications.sendEmail(rescheduledEmail(found.order, appointment.kind, was, target));
    return { appointment, changed, emailed: true };
  } catch (err) {
    // The owner sees the warning; the log is what explains it.
    console.error(`[orders] visit rescheduled, but the customer email failed: ${redactForLog(err instanceof Error ? err.message : String(err))}`);
    return { appointment, changed, emailed: false };
  }
}
