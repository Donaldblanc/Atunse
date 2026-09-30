import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { orderNumber } from "@/features/orders/domain";
import type { OrderRepository } from "@/features/orders/repositories/order-repository";
import { returnVisitState, type ReturnVisitState } from "@/features/orders/return-visit";
import { SHOP_TIMEZONE } from "@/features/orders/calendar-date";

export interface ReturnBookingDeps {
  orders: Pick<OrderRepository, "findById">;
}

export interface ReturnBooking {
  orderId: string;
  reference: string;
  customer: { name: string; email: string };
  state: ReturnVisitState;
  /** When a Return is already on the Calendar: "Thu, Oct 8, 10:00 AM", shop time; and its id for linking. */
  booked: { appointmentId: string; when: string } | null;
}

const when = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: SHOP_TIMEZONE });

/**
 * What the "Book return visit" picker and its entry points need to know
 * about one Order, or null for an id no Order has. Admin-only (ADR-0012).
 */
export async function getReturnBooking(deps: ReturnBookingDeps, actingUser: ActingUser, orderId: string): Promise<ReturnBooking | null> {
  requireRole(actingUser, "ADMIN");
  const order = await deps.orders.findById(orderId);
  if (!order) return null;
  const state = returnVisitState(order);
  return {
    orderId: order.id,
    reference: orderNumber(order.number),
    customer: { name: order.contactName, email: order.contactEmail },
    state,
    booked: state.kind === "booked" ? { appointmentId: state.appointment.id, when: when.format(state.appointment.startsAt) } : null,
  };
}
