import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { calendarDateInShopTime, calendarDateToUtcMidnight } from "@/features/orders/calendar-date";
import { liveEstimate, livePairs, orderNumber, planVisitMoves, type Address, type Appointment, type VisitPlan } from "@/features/orders/domain";
import type { OrderRepository } from "@/features/orders/repositories/order-repository";
import type { Money } from "@/shared/money/money";
import { servicesSummary, visitTime, type AdminOverviewDeps } from "./get-admin-overview";
import { pairPhoto, type PairPhoto } from "./pair-photo";

export interface ScheduledVisitDeps {
  orders: Pick<OrderRepository, "findAppointment">;
  photoUrl: AdminOverviewDeps["photoUrl"];
}

/** Everything the Schedule Item dialog shows about one Appointment (design: "Schedule Item"). */
export interface ScheduledVisitDetail {
  appointmentId: string;
  kind: Appointment["kind"];
  status: Appointment["status"];
  /** The start instant: what Reschedule sends back so a stale dialog can't overwrite a newer move. */
  startsAt: Date;
  /** "6:00 PM – 6:30 PM", shop time. */
  window: string;
  /** "Fri, Sep 26, 2026", shop time. */
  date: string;
  /** The owner's note on the visit, or null. */
  notes: string | null;
  /** Each pair's name in this Order (itemId to "Pair 2 (Nike Air Max 90)"), for the lists of who moved and who didn't. */
  pairLabels: Record<string, string>;
  /** What completing a SCHEDULED visit would do to the pairs (planVisitMoves); empty once it isn't scheduled. */
  plan: VisitPlan;
  customer: {
    name: string;
    phone: string;
    email: string;
    /** The Local Drop-Off address, one line: where DJ collects from and returns to. */
    address: string;
  };
  order: {
    id: string;
    reference: string;
    /** The first pair's first photo. */
    photo: PairPhoto;
    /** The first pair's brand and model, e.g. "Nike Air Max 90". */
    firstPair: string | null;
    /** Pairs not cancelled (every pair for a fully cancelled Order). */
    pairCount: number;
    estimate: Money;
    estimateIsMinimum: boolean;
    /** e.g. "Premium Clean + Lace Replacement" (servicesSummary). */
    services: string;
  };
}

const visitDate = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** An admin's name for one pair: "Pair 2 (Nike Air Max 90)", or just "The pair" when the Order has one. */
export function pairLabel(order: { items: { brand: string | null; model: string | null }[] }, index: number): string {
  if (order.items.length === 1) return "The pair";
  const title = [order.items[index]!.brand, order.items[index]!.model].filter(Boolean).join(" ");
  return `Pair ${index + 1}${title ? ` (${title})` : ""}`;
}

export function formatAddress(address: Address): string {
  return [address.line1, address.line2, `${address.city}, ${address.state} ${address.zip}`].filter(Boolean).join(", ");
}

/**
 * One Appointment for the Overview's Schedule Item dialog, or null when no
 * Appointment has this id (a stale or mistyped link). Any status loads, so a
 * visit completed in another tab still opens and shows its status.
 * Admin-only (ADR-0012).
 */
export async function getScheduledVisit(
  deps: ScheduledVisitDeps,
  actingUser: ActingUser,
  appointmentId: string,
): Promise<ScheduledVisitDetail | null> {
  requireRole(actingUser, "ADMIN");

  const found = await deps.orders.findAppointment(appointmentId);
  if (!found) return null;
  const { appointment, order } = found;

  // Like Recent Orders: the live pairs, or, for a fully cancelled Order, every pair.
  const live = livePairs(order);
  const pairs = live.length > 0 ? live : order.items;
  const first = pairs[0];
  const photoKey = first?.photoKeys[0];

  return {
    appointmentId: appointment.id,
    kind: appointment.kind,
    status: appointment.status,
    startsAt: appointment.startsAt,
    window: `${visitTime.format(appointment.startsAt)} – ${visitTime.format(appointment.endsAt)}`,
    // Formatted from the shop-time day, so an evening visit never shows the next UTC day.
    date: visitDate.format(calendarDateToUtcMidnight(calendarDateInShopTime(appointment.startsAt))),
    notes: appointment.notes?.trim() || null,
    pairLabels: Object.fromEntries(order.items.map((item, index) => [item.id, pairLabel(order, index)])),
    plan: appointment.status === "SCHEDULED" ? planVisitMoves(appointment.kind, order) : { moves: [], stays: [] },
    customer: { name: order.contactName, phone: order.contactPhone, email: order.contactEmail, address: formatAddress(order.fulfillment.address) },
    order: {
      id: order.id,
      reference: orderNumber(order.number),
      photo: await pairPhoto(photoKey, deps.photoUrl),
      firstPair: [first?.brand, first?.model].filter(Boolean).join(" ") || null,
      pairCount: pairs.length,
      estimate: live.length > 0 ? liveEstimate(order) : order.estimate,
      estimateIsMinimum: order.estimateIsMinimum,
      services: servicesSummary(pairs.map((item) => item.serviceIds)),
    },
  };
}
