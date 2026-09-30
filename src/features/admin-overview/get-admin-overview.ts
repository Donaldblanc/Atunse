import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { calendarDateInShopTime, type CalendarDate } from "@/features/orders/calendar-date";
import type { ItemStatus, Order } from "@/features/orders/domain";
import type { OrderRepository } from "@/features/orders/repositories/order-repository";
import { SERVICE_CATALOG } from "@/features/orders/service-catalog";
import { Money } from "@/shared/money/money";
import { overviewRange, type OverviewRange, type OverviewRangeId } from "./overview-range";

export interface AdminOverviewDeps {
  orders: Pick<OrderRepository, "listBookedBetween" | "countItemsByStatus" | "summarizeAwaitingDeposit">;
  now: () => Date;
}

export interface AdminOverview {
  range: OverviewRange;
  /** Orders booked in the range and the stretch before it. */
  orders: { current: number; previous: number };
  /** The booked Orders' estimates added up (Rush included): what's been booked, not what's been paid. */
  bookedRevenue: { current: Money; previous: Money };
  /** bookedRevenue per day of the range, oldest first. */
  revenueByDay: { date: CalendarDate; revenue: Money }[];
  /** How many of the range's pairs included each Service, in catalog order; unbooked Services are left out. */
  servicesBooked: { serviceId: string; name: string; count: number }[];
  /** Right now, whatever the range: pairs waiting on the owner's quote (ADR-0001). */
  needsQuote: number;
  /** Right now: Orders whose Deposit isn't confirmed yet (ADR-0002). */
  awaitingDeposit: { orders: number; deposits: Money };
  /** Right now: pairs finished and waiting to go back (Ready for Drop-Off/Shipping). */
  readyForReturn: number;
}

const NEEDS_QUOTE: ItemStatus[] = ["REQUEST_SUBMITTED", "UNDER_REVIEW"];

/** A fully cancelled Order was booked but isn't business: it's left out of every figure. */
function isLive(order: Order): boolean {
  return order.items.some((item) => item.status !== "CANCELLED");
}

function sumEstimates(orders: Order[]): Money {
  return orders.reduce((sum, order) => sum.add(order.estimate), Money.zero());
}

/** The admin Overview (the first admin screen): admin-only (ADR-0012). */
export async function getAdminOverview(deps: AdminOverviewDeps, actingUser: ActingUser, rangeId: OverviewRangeId): Promise<AdminOverview> {
  requireRole(actingUser, "ADMIN");

  const range = overviewRange(rangeId, deps.now());
  const [booked, bookedBefore, statusCounts, awaitingDeposit] = await Promise.all([
    deps.orders.listBookedBetween(range.start, range.end),
    deps.orders.listBookedBetween(range.previous.start, range.previous.end),
    deps.orders.countItemsByStatus(),
    deps.orders.summarizeAwaitingDeposit(),
  ]);
  const current = booked.filter(isLive);
  const previous = bookedBefore.filter(isLive);

  const revenueByDay = range.days.map((date) => ({
    date,
    revenue: sumEstimates(current.filter((order) => calendarDateInShopTime(order.createdAt) === date)),
  }));

  const serviceCounts = new Map<string, number>();
  for (const item of current.flatMap((order) => order.items)) {
    if (item.status === "CANCELLED") continue;
    for (const serviceId of item.serviceIds) serviceCounts.set(serviceId, (serviceCounts.get(serviceId) ?? 0) + 1);
  }
  const servicesBooked = SERVICE_CATALOG.filter((service) => serviceCounts.has(service.id)).map((service) => ({
    serviceId: service.id,
    name: service.name,
    count: serviceCounts.get(service.id)!,
  }));

  return {
    range,
    orders: { current: current.length, previous: previous.length },
    bookedRevenue: { current: sumEstimates(current), previous: sumEstimates(previous) },
    revenueByDay,
    servicesBooked,
    needsQuote: NEEDS_QUOTE.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0),
    awaitingDeposit,
    readyForReturn: statusCounts.READY_FOR_PICKUP_SHIPPING ?? 0,
  };
}

/**
 * Whole-number percent change, or null when there's nothing to compare
 * with (a first week can't be "up" on nothing).
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
