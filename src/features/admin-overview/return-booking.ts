import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { orderNumber, type Order } from "@/features/orders/domain";
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
 * An Order's Return visit as the admin screens show it: bookable now,
 * booked (with when, "Thu, Oct 8, 10:00 AM" shop time, and the visit's id
 * for linking), or none (Mail-In ships, or nothing is ready). The Order
 * dialog, the Ready to Return panel and the picker all use this one
 * mapping, so they can't drift apart.
 */
export type ReturnVisitSummary = { kind: "bookable" } | { kind: "booked"; appointmentId: string; when: string } | { kind: "none" };

export function summarizeReturnVisit(order: Pick<Order, "fulfillment" | "items" | "appointments">): ReturnVisitSummary {
  const state = returnVisitState(order);
  if (state.kind === "bookable") return { kind: "bookable" };
  if (state.kind === "booked") return { kind: "booked", appointmentId: state.appointment.id, when: when.format(state.appointment.startsAt) };
  return { kind: "none" };
}

/**
 * What the "Book return visit" picker and its entry points need to know
 * about one Order, or null for an id no Order has. Admin-only (ADR-0012).
 */
export async function getReturnBooking(deps: ReturnBookingDeps, actingUser: ActingUser, orderId: string): Promise<ReturnBooking | null> {
  requireRole(actingUser, "ADMIN");
  const order = await deps.orders.findById(orderId);
  if (!order) return null;
  const state = returnVisitState(order);
  const summary = summarizeReturnVisit(order);
  return {
    orderId: order.id,
    reference: orderNumber(order.number),
    customer: { name: order.contactName, email: order.contactEmail },
    state,
    booked: summary.kind === "booked" ? { appointmentId: summary.appointmentId, when: summary.when } : null,
  };
}
