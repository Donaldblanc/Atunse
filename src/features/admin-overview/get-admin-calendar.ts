import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { addDays, calendarDateInShopTime, shopMidnight, type CalendarDate } from "@/features/orders/calendar-date";
import { orderNumber, type Appointment } from "@/features/orders/domain";
import type { OrderRepository } from "@/features/orders/repositories/order-repository";
import { monthGrid, type MonthGrid } from "./calendar-month";
import { isLiveVisit, visitTime } from "./get-admin-overview";

/** One visit on the Calendar's month grid. */
export interface CalendarVisit {
  appointmentId: string;
  reference: string;
  customerName: string;
  kind: Appointment["kind"];
  /** "9:30 AM", shop time. */
  time: string;
}

export interface AdminCalendar {
  grid: MonthGrid;
  /** Live, scheduled visits for every day on the grid (the month plus the neighbouring days that fill its first and last weeks), grouped by the shop-time day they fall on. A day with none has no entry. */
  visitsByDay: Map<CalendarDate, CalendarVisit[]>;
}

/**
 * The scheduled visits (collections and returns) for every day shown on the
 * Calendar's month grid, reusing the same `listAppointmentsBetween` query
 * and live-visit filter as Today's Schedule and Upcoming Visits. Admin-only
 * (ADR-0012).
 */
export async function getAdminCalendar(
  deps: { orders: Pick<OrderRepository, "listAppointmentsBetween"> },
  actingUser: ActingUser,
  month: CalendarDate,
): Promise<AdminCalendar> {
  requireRole(actingUser, "ADMIN");

  const grid = monthGrid(month);
  const firstDay = grid.days[0]!;
  const lastDay = grid.days[grid.days.length - 1]!;
  const appointments = await deps.orders.listAppointmentsBetween(shopMidnight(firstDay), shopMidnight(addDays(lastDay, 1)));

  const visitsByDay = new Map<CalendarDate, CalendarVisit[]>();
  for (const appointment of appointments) {
    if (!isLiveVisit(appointment)) continue;
    const day = calendarDateInShopTime(appointment.startsAt);
    const visit: CalendarVisit = {
      appointmentId: appointment.id,
      reference: orderNumber(appointment.order.number),
      customerName: appointment.order.contactName,
      kind: appointment.kind,
      time: visitTime.format(appointment.startsAt),
    };
    const existing = visitsByDay.get(day);
    if (existing) existing.push(visit);
    else visitsByDay.set(day, [visit]);
  }

  return { grid, visitsByDay };
}

