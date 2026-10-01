// When an Order can have a Return visit booked. Pure: the Order dialog, the
// Ready to Return panel and the booking use-case all ask this one question,
// so they can't disagree.

import type { Appointment, Order } from "./domain";

export type ReturnVisitState =
  /** DJ can be booked to drop the pairs back off: a pair is ready and no live Return exists. */
  | { kind: "bookable" }
  /** A Return is already on the Calendar (SCHEDULED, or COMPLETED). */
  | { kind: "booked"; appointment: Appointment }
  /** No Return applies: Mail-In ships, or no pair is ready to go back yet. */
  | { kind: "unavailable"; reason: "mail-in" | "nothing-ready" };

/**
 * CONTEXT.md: an Appointment is a Collection or Return for a Local Drop-Off
 * Order; Mail-In Orders ship, so they never get one. A Return makes sense
 * once a pair is Ready for Drop-Off/Shipping. A CANCELLED Return doesn't
 * count as booked: it is bookable again (the repository reuses the row).
 */
export function returnVisitState(order: Pick<Order, "fulfillment" | "items" | "appointments">): ReturnVisitState {
  if (order.fulfillment.method !== "PICKUP") return { kind: "unavailable", reason: "mail-in" };
  const live = order.appointments.find((appointment) => appointment.kind === "RETURN" && appointment.status !== "CANCELLED");
  if (live) return { kind: "booked", appointment: live };
  if (!order.items.some((item) => item.status === "READY_FOR_PICKUP_SHIPPING")) return { kind: "unavailable", reason: "nothing-ready" };
  return { kind: "bookable" };
}
