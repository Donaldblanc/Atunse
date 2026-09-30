import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { addDays, calendarDateInShopTime, SHOP_TIMEZONE, shopMidnight, type CalendarDate } from "@/features/orders/calendar-date";
import {
  liveEstimate,
  livePairs,
  orderNumber,
  orderRollupStatus,
  type Appointment,
  type ItemStatus,
  type Order,
  type Payment,
  type PaymentMethod,
} from "@/features/orders/domain";
import type { AwaitingDeposits, OrderRepository } from "@/features/orders/repositories/order-repository";
import { SERVICE_CATALOG } from "@/features/orders/service-catalog";
import { Money } from "@/shared/money/money";
import { metricDetail, type MetricDetail } from "./metric-detail";
import { pairPhoto, type PairPhoto } from "./pair-photo";
import { overviewRange, type OverviewRange, type OverviewSelection } from "./overview-range";

export interface AdminOverviewDeps {
  orders: Pick<
    OrderRepository,
    | "listBookedBetween"
    | "summarizeBookedBetween"
    | "countItemsByStatus"
    | "summarizeAwaitingDeposit"
    | "listRecent"
    | "listAppointmentsBetween"
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
  /** The first pair's first photo. */
  photo: PairPhoto;
  /** Pairs not cancelled (every pair for a fully cancelled Order, which shows what was booked). */
  pairCount: number;
  /** The first of those pairs' brand and model, e.g. "Nike Air Max 90". */
  firstPair: string | null;
  /** e.g. "Premium Clean + Lace Replacement" (servicesSummary). */
  services: string;
  status: ItemStatus;
  /** The Order's Deposit Payment, or null if it has none (e.g. a $0 estimate). */
  deposit: { method: PaymentMethod; status: Payment["status"] } | null;
  total: Money;
  totalIsMinimum: boolean;
}

/** A Local Drop-Off visit scheduled for today: DJ collecting a pair, or dropping it back off. */
export interface ScheduledVisit {
  /** The Appointment, for the `?visit=` link to its Schedule Item dialog. */
  appointmentId: string;
  orderId: string;
  reference: string;
  customerName: string;
  kind: Appointment["kind"];
  /** When it starts, shop time, e.g. "6:00 PM". */
  time: string;
}

const visitTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: SHOP_TIMEZONE });

const RECENT_ORDERS = 5;

export interface AdminOverview {
  range: OverviewRange;
  /**
   * Orders booked in the range and the stretch before it. One rule for
   * cancelled pairs across every figure: they drop out, so a fully
   * cancelled Order doesn't count at all (liveEstimate in domain.ts).
   */
  orders: { current: number; previous: number };
  /** The booked Orders' live estimates added up (Rush included): what's been booked, not what's been paid. */
  bookedRevenue: { current: Money; previous: Money };
  /** bookedRevenue per day of the range, oldest first. */
  revenueByDay: { date: CalendarDate; revenue: Money }[];
  /** The range's Orders by day and by status, for the metric dialog (metric-detail.ts). */
  metricDetail: MetricDetail;
  /** How many of the range's pairs included each Service, in catalog order; unbooked Services are left out. */
  servicesBooked: { serviceId: string; name: string; count: number }[];
  /** Right now, whatever the range: pairs waiting on the owner's quote (ADR-0001). */
  needsQuote: number;
  /** Right now: Orders whose Deposit Payment is still PENDING (ADR-0002), and how they're paying. */
  awaitingDeposit: AwaitingDeposits;
  /** Right now: pairs finished and waiting to go back (Ready for Drop-Off/Shipping). */
  readyForReturn: number;
  /** The latest bookings, whatever the range. */
  recentOrders: RecentOrder[];
  /**
   * Today's (New York) SCHEDULED Appointments, collections and returns, in
   * time order: read from the Calendar's Appointments, so a rescheduled
   * visit shows on its new day.
   */
  todaysSchedule: ScheduledVisit[];
}

const NEEDS_QUOTE: ItemStatus[] = ["REQUEST_SUBMITTED", "UNDER_REVIEW"];

/** A fully cancelled Order was booked but isn't business: it's left out of every figure. */
function isLive(order: { items: { status: ItemStatus }[] }): boolean {
  return livePairs(order).length > 0;
}

/** The admin Overview (the first admin screen): admin-only (ADR-0012). */
export async function getAdminOverview(deps: AdminOverviewDeps, actingUser: ActingUser, selection: OverviewSelection): Promise<AdminOverview> {
  requireRole(actingUser, "ADMIN");

  const now = deps.now();
  const range = overviewRange(selection, now);
  const today = calendarDateInShopTime(now);
  const [booked, previous, statusCounts, awaitingDeposit, recent, appointments] = await Promise.all([
    deps.orders.listBookedBetween(range.start, range.end),
    // Only totals are needed for the stretch before, so it's aggregated, not loaded.
    deps.orders.summarizeBookedBetween(range.previous.start, range.previous.end),
    deps.orders.countItemsByStatus(),
    deps.orders.summarizeAwaitingDeposit(),
    deps.orders.listRecent(RECENT_ORDERS),
    deps.orders.listAppointmentsBetween(shopMidnight(today), shopMidnight(addDays(today, 1))),
  ]);
  const current = booked.filter(isLive);

  // One pass: each Order's day is worked out once, not once per day of the range.
  const revenueByDate = new Map<CalendarDate, Money>();
  for (const order of current) {
    const date = calendarDateInShopTime(order.createdAt);
    revenueByDate.set(date, (revenueByDate.get(date) ?? Money.zero()).add(liveEstimate(order)));
  }
  const revenueByDay = range.days.map((date) => ({ date, revenue: revenueByDate.get(date) ?? Money.zero() }));

  const serviceCounts = new Map<string, number>();
  for (const item of current.flatMap(livePairs)) {
    for (const serviceId of item.serviceIds) serviceCounts.set(serviceId, (serviceCounts.get(serviceId) ?? 0) + 1);
  }
  const servicesBooked = SERVICE_CATALOG.filter((service) => serviceCounts.has(service.id)).map((service) => ({
    serviceId: service.id,
    name: service.name,
    count: serviceCounts.get(service.id)!,
  }));

  return {
    range,
    orders: { current: current.length, previous: previous.orders },
    bookedRevenue: { current: current.reduce((sum, order) => sum.add(liveEstimate(order)), Money.zero()), previous: previous.value },
    revenueByDay,
    metricDetail: metricDetail(booked, range.days),
    servicesBooked,
    needsQuote: NEEDS_QUOTE.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0),
    awaitingDeposit,
    readyForReturn: statusCounts.READY_FOR_PICKUP_SHIPPING ?? 0,
    recentOrders: await Promise.all(recent.map((order) => toRecentOrder(order, deps.photoUrl))),
    todaysSchedule: appointments
      .filter((appointment) => appointment.order.itemStatuses.some((status) => status !== "CANCELLED"))
      .map((appointment) => ({
        appointmentId: appointment.id,
        orderId: appointment.order.id,
        reference: orderNumber(appointment.order.number),
        customerName: appointment.order.contactName,
        kind: appointment.kind,
        time: visitTime.format(appointment.startsAt),
      })),
  };
}

async function toRecentOrder(order: Order, photoUrl: AdminOverviewDeps["photoUrl"]): Promise<RecentOrder> {
  // The whole row describes the same pairs: the live ones, or, for a fully
  // cancelled Order, every pair, so it still shows what was booked.
  const live = livePairs(order);
  const pairs = live.length > 0 ? live : order.items;
  const first = pairs[0];
  const photoKey = first?.photoKeys[0];
  const deposit = order.payments.find((payment) => payment.kind === "DEPOSIT");
  return {
    orderId: order.id,
    reference: orderNumber(order.number),
    customerName: order.contactName,
    bookedAt: order.createdAt,
    photo: await pairPhoto(photoKey, photoUrl),
    pairCount: pairs.length,
    firstPair: [first?.brand, first?.model].filter(Boolean).join(" ") || null,
    services: servicesSummary(pairs.map((item) => item.serviceIds)),
    status: orderRollupStatus(order.items),
    deposit: deposit ? { method: deposit.method, status: deposit.status } : null,
    total: live.length > 0 ? liveEstimate(order) : order.estimate,
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

/**
 * The Overview's change badge: which way the figure moved (from the raw
 * difference, so a small real change never reads as flat) and its label,
 * "<1%" when it rounds to 0 without being equal. Null: nothing to compare.
 */
export function changeBadge(current: number, previous: number): { tone: "up" | "down" | "flat"; label: string } | null {
  const change = percentChange(current, previous);
  if (change === null) return null;
  const difference = current - previous;
  const tone = difference > 0 ? "up" : difference < 0 ? "down" : "flat";
  return { tone, label: change === 0 && difference !== 0 ? "<1%" : `${Math.abs(change)}%` };
}
