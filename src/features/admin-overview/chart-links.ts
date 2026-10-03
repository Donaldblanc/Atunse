import { calendarDateToUtcMidnight, type CalendarDate } from "@/features/orders/calendar-date";
import { SERVICE_CATALOG } from "@/features/orders/service-catalog";
import { overviewHref, type OverviewSelection } from "./overview-range";

const dayLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "Wed, Sep 30". */
export function formatChartDay(day: CalendarDate): string {
  return dayLabel.format(calendarDateToUtcMidnight(day));
}

/** A Revenue Trend bar opens All orders booked that shop day (the range is kept, so closing returns to it). */
export function revenueBarHref(selection: OverviewSelection, day: CalendarDate): string {
  return overviewHref(selection, { orders: "all", day });
}

/** An Orders by Service legend row opens All orders with that Service, within the range. */
export function serviceLegendHref(selection: OverviewSelection, serviceId: string): string {
  return overviewHref(selection, { orders: "all", service: serviceId });
}

/** The Revenue Trend card title opens the revenue metric detail. */
export function revenueTrendTitleHref(selection: OverviewSelection): string {
  return overviewHref(selection, { metric: "revenue" });
}

/** What the All orders dialog says is filtered, or null when neither the day nor the Service is. `rangeDates` is e.g. "Sep 28 – Oct 4, 2026". */
export function ordersFilterLabel(filter: { day: CalendarDate | null; serviceId: string | null }, rangeDates: string): string | null {
  const service = filter.serviceId ? SERVICE_CATALOG.find((s) => s.id === filter.serviceId)?.name : undefined;
  if (filter.day) return service ? `${service} · Booked ${formatChartDay(filter.day)}` : `Booked ${formatChartDay(filter.day)}`;
  return service ? `${service} · ${rangeDates}` : null;
}
