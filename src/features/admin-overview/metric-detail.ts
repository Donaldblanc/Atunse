// What the "View Metric Details" dialog shows behind Total Orders and
// Booked Revenue: the range's Orders per day, and where they sit in the
// pipeline. Pure, computed from the Orders the Overview already loaded,
// so opening the dialog costs no second query.

import { calendarDateInShopTime, type CalendarDate } from "@/features/orders/calendar-date";
import { ITEM_STATUSES, liveEstimate, livePairs, orderRollupStatus, type ItemStatus } from "@/features/orders/domain";
import type { BookedOrder } from "@/features/orders/repositories/order-repository";
import { Money } from "@/shared/money/money";

export const OVERVIEW_METRICS = ["orders", "revenue"] as const;
export type OverviewMetric = (typeof OVERVIEW_METRICS)[number];

/** A `?metric=` value, or null for anything else (no dialog). */
export function parseOverviewMetric(value: string | string[] | undefined): OverviewMetric | null {
  return OVERVIEW_METRICS.find((metric) => metric === value) ?? null;
}

export interface StatusShare {
  status: ItemStatus;
  orders: number;
  /** These Orders' live estimates added up. */
  revenue: Money;
}

export interface MetricDetail {
  /** Live Orders booked on each day of the range, oldest first. */
  ordersByDay: { date: CalendarDate; orders: number }[];
  /**
   * Live Orders by their rollup status (orderRollupStatus), in pipeline
   * order, statuses with no Orders left out. Adds up to the headline
   * Total Orders / Booked Revenue exactly, because fully cancelled Orders
   * (the only ones with a CANCELLED rollup) are not in it.
   */
  byStatus: StatusShare[];
  /**
   * Fully cancelled Orders booked in the range. The headline figures leave
   * them out (one rule for cancelled pairs, liveEstimate in domain.ts), but
   * the owner may want to see how many bookings fell through, so the dialog
   * shows them apart from `byStatus`, never mixed into its percentages.
   */
  cancelledOrders: number;
}

/** Breaks the Orders booked in the range down by day and by status. `days` are the range's days, oldest first. */
export function metricDetail(booked: BookedOrder[], days: CalendarDate[]): MetricDetail {
  const perDay = new Map<CalendarDate, number>(days.map((date) => [date, 0]));
  const perStatus = new Map<ItemStatus, StatusShare>();
  let cancelledOrders = 0;

  for (const order of booked) {
    if (livePairs(order).length === 0) {
      cancelledOrders += 1;
      continue;
    }
    const date = calendarDateInShopTime(order.createdAt);
    if (perDay.has(date)) perDay.set(date, perDay.get(date)! + 1);

    const status = orderRollupStatus(order.items);
    const share = perStatus.get(status) ?? { status, orders: 0, revenue: Money.zero() };
    share.orders += 1;
    share.revenue = share.revenue.add(liveEstimate(order));
    perStatus.set(status, share);
  }

  return {
    ordersByDay: days.map((date) => ({ date, orders: perDay.get(date)! })),
    byStatus: ITEM_STATUSES.filter((status) => perStatus.has(status)).map((status) => perStatus.get(status)!),
    cancelledOrders,
  };
}

/** The Overview's URL: the range params carried over (`range`, and `from`/`to` for a custom range), plus a `metric` when one is open. */
export function overviewHref(params: { [key: string]: string | string[] | undefined }, metric?: OverviewMetric): string {
  const query = new URLSearchParams();
  for (const key of ["range", "from", "to"]) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  }
  if (metric) query.set("metric", metric);
  const search = query.toString();
  return search ? `/admin?${search}` : "/admin";
}
