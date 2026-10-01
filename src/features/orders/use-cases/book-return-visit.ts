import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { NotificationService } from "@/features/notifications/notification-service";
import type { Appointment } from "../domain";
import { OrderNotFoundError, type OrderRepository } from "../repositories/order-repository";
import { returnVisitState } from "../return-visit";
import { returnBookedEmail } from "../visit-emails";
import { resolveVisitSlot } from "../visit-slot";
import { redactForLog } from "@/shared/logging/redact";

export interface BookReturnVisitDeps {
  orders: Pick<OrderRepository, "findById" | "bookReturnAppointment">;
  notifications: NotificationService;
  now: () => Date;
}

/** The Order can't have a Return booked (Mail-In, or no pair is ready). The message is safe to show. */
export class ReturnNotAvailableError extends Error {
  constructor(readonly reason: "mail-in" | "nothing-ready") {
    super(reason === "mail-in" ? "Mail-In orders are shipped back, so they have no return visit." : "No pair on this order is ready to go back yet.");
    this.name = "ReturnNotAvailableError";
  }
}

export interface BookReturnVisitResult {
  appointment: Appointment;
  /** False for a replay (this Return was already booked at this time): nothing was sent again. */
  created: boolean;
  /** Whether the customer's email went out; false when the booking stands but the send failed. */
  emailed: boolean;
}

/**
 * The owner books DJ's Return visit for a Local Drop-Off Order that has a
 * pair ready to go back (returnVisitState). Creates the RETURN Appointment,
 * SCHEDULED, and emails the customer the time. Admin-only (ADR-0012).
 *
 * Idempotent without a stored key: the Order has at most one RETURN
 * (unique on orderId + kind), so a replay finds it already booked at this
 * time and neither creates nor emails again; a different time is refused
 * (ReturnAlreadyBookedError), which is what a stale dialog should see.
 * Rescheduling is how a booked Return moves. A CANCELLED Return is reused
 * by the repository. An email failure leaves the booking in place and
 * reports `emailed: false`.
 */
export async function bookReturnVisit(
  deps: BookReturnVisitDeps,
  actingUser: ActingUser,
  input: { orderId: string; date: string; slot: string },
): Promise<BookReturnVisitResult> {
  requireRole(actingUser, "ADMIN");
  const order = await deps.orders.findById(input.orderId);
  if (!order) throw new OrderNotFoundError(input.orderId);
  const target = resolveVisitSlot(input.date, input.slot, deps.now());

  // A replay finds the Return already booked (state "booked"): let the repository decide replay vs. conflict.
  const state = returnVisitState(order);
  if (state.kind === "unavailable") throw new ReturnNotAvailableError(state.reason);

  const { appointment, created } = await deps.orders.bookReturnAppointment({ orderId: order.id, ...target });
  if (!created) return { appointment, created, emailed: false };

  try {
    await deps.notifications.sendEmail(returnBookedEmail(order, target));
    return { appointment, created, emailed: true };
  } catch (err) {
    // The owner sees the warning; the log is what explains it.
    console.error(`[orders] return visit booked, but the customer email failed: ${redactForLog(err instanceof Error ? err.message : String(err))}`);
    return { appointment, created, emailed: false };
  }
}
