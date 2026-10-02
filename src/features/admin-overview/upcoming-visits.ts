import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { addDays, calendarDateInShopTime, SHOP_TIMEZONE, shopMidnight } from "@/features/orders/calendar-date";
import { orderNumber, type Appointment } from "@/features/orders/domain";
import type { OrderRepository } from "@/features/orders/repositories/order-repository";
import { visitTime } from "./get-admin-overview";

/** How far ahead the Upcoming visits dialog looks, today included. */
export const UPCOMING_VISIT_DAYS = 14;

const visitDay = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: SHOP_TIMEZONE });

export interface UpcomingVisit {
  appointmentId: string;
  reference: string;
  customerName: string;
  kind: Appointment["kind"];
  /** "Fri, Oct 2", shop time. */
  day: string;
  /** "9:30 AM", shop time. */
  time: string;
}

/**
 * The SCHEDULED visits (collections and returns) in the next 14 days, in
 * time order, leaving out those of fully cancelled Orders like Today's
 * Schedule does. Admin-only (ADR-0012).
 */
export async function getUpcomingVisits(
  deps: { orders: Pick<OrderRepository, "listAppointmentsBetween"> },
  actingUser: ActingUser,
  now: Date,
): Promise<UpcomingVisit[]> {
  requireRole(actingUser, "ADMIN");

  const today = calendarDateInShopTime(now);
  const appointments = await deps.orders.listAppointmentsBetween(shopMidnight(today), shopMidnight(addDays(today, UPCOMING_VISIT_DAYS)));
  return appointments
    .filter((appointment) => appointment.order.itemStatuses.some((status) => status !== "CANCELLED"))
    .map((appointment) => ({
      appointmentId: appointment.id,
      reference: orderNumber(appointment.order.number),
      customerName: appointment.order.contactName,
      kind: appointment.kind,
      day: visitDay.format(appointment.startsAt),
      time: visitTime.format(appointment.startsAt),
    }));
}
