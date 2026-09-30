import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { calendarDateInShopTime, type CalendarDate } from "@/features/orders/calendar-date";
import { orderReference, orderRollupStatus, type ItemStatus, type Order } from "@/features/orders/domain";
import { PICKUP_TIME_SLOTS } from "@/features/orders/pickup-window";
import type { OrderRepository } from "@/features/orders/repositories/order-repository";
import { SERVICE_CATALOG } from "@/features/orders/service-catalog";
import { Money } from "@/shared/money/money";
import { overviewRange, type OverviewRange, type OverviewRangeId } from "./overview-range";

export interface AdminOverviewDeps {
  orders: Pick<
    OrderRepository,
    "listBookedBetween" | "countItemsByStatus" | "summarizeAwaitingDeposit" | "listRecent" | "listCollectionsOn" | "findPaidOrderIds"
  >;
  /** A short-lived view link for a stored photo (ADR-0014), or null when photos can't be shown. */
  photoUrl: (key: string) => Promise<string | null>;
  now: () => Date;
}

/** One row of the Overview's Recent Orders table. */
export interface RecentOrder {
  orderId: string;
  reference: string;
  customerName: string;
  bookedAt: Date;
  /** The first pair's first photo, or null. */
  photoUrl: string | null;
  pairCount: number;
  /** The first pair's brand/model as the customer typed it. */
  firstPair: string | null;
  /** e.g. "Premium Clean + Lace Replacement" (servicesSummary). */
  services: string;
  status: ItemStatus;
  depositPaid: boolean;
  total: Money;
  totalIsMinimum: boolean;
}

/** A Local Drop-Off collection booked for today, in time order. */
export interface ScheduledCollection {
  orderId: string;
  reference: string;
  customerName: string;
  /** The slot's start as booked, e.g. "6:00 PM". */
  time: string;
}

const RECENT_ORDERS = 5;

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
  /** The latest bookings, whatever the range. */
  recentOrders: RecentOrder[];
  /** Today's (New York) Local Drop-Off collections. */
  todaysCollections: ScheduledCollection[];
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

  const now = deps.now();
  const range = overviewRange(rangeId, now);
  const [booked, bookedBefore, statusCounts, awaitingDeposit, recent, collections] = await Promise.all([
    deps.orders.listBookedBetween(range.start, range.end),
    deps.orders.listBookedBetween(range.previous.start, range.previous.end),
    deps.orders.countItemsByStatus(),
    deps.orders.summarizeAwaitingDeposit(),
    deps.orders.listRecent(RECENT_ORDERS),
    deps.orders.listCollectionsOn(calendarDateInShopTime(now)),
  ]);
  const paidOrderIds = await deps.orders.findPaidOrderIds(recent.map((order) => order.id));
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
    recentOrders: await Promise.all(recent.map((order) => toRecentOrder(order, paidOrderIds.has(order.id), deps.photoUrl))),
    todaysCollections: collections
      .filter(isLive)
      .flatMap((order) =>
        order.fulfillment.method === "PICKUP"
          ? [{ orderId: order.id, reference: orderReference(order.id), customerName: order.contactName, slot: order.fulfillment.slot }]
          : [],
      )
      .sort((a, b) => PICKUP_TIME_SLOTS.indexOf(a.slot) - PICKUP_TIME_SLOTS.indexOf(b.slot))
      .map(({ slot, ...collection }) => ({ ...collection, time: slot.split(" – ")[0]! })),
  };
}

async function toRecentOrder(order: Order, depositPaid: boolean, photoUrl: AdminOverviewDeps["photoUrl"]): Promise<RecentOrder> {
  const first = order.items[0];
  const photoKey = first?.photoKeys[0];
  return {
    orderId: order.id,
    reference: orderReference(order.id),
    customerName: order.contactName,
    bookedAt: order.createdAt,
    photoUrl: photoKey ? await photoUrl(photoKey) : null,
    pairCount: order.items.length,
    firstPair: first?.brand ?? first?.model ?? null,
    services: servicesSummary(order.items.filter((item) => item.status !== "CANCELLED").map((item) => item.serviceIds)),
    status: orderRollupStatus(order.items),
    depositPaid,
    total: order.estimate,
    totalIsMinimum: order.estimateIsMinimum,
  };
}

/**
 * The Services an Order's pairs take, as one short label: every distinct
 * Service in catalog order, "A + B" for two, "A + 2 more" past that.
 */
export function servicesSummary(serviceIdsByPair: string[][]): string {
  const ids = new Set(serviceIdsByPair.flat());
  const names = SERVICE_CATALOG.filter((service) => ids.has(service.id)).map((service) => service.name);
  if (names.length <= 2) return names.join(" + ");
  return `${names[0]} + ${names.length - 1} more`;
}

/**
 * Whole-number percent change, or null when there's nothing to compare
 * with (a first week can't be "up" on nothing).
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
