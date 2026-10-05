import type { CalendarDate } from "@/features/orders/calendar-date";
import type { OverviewRange } from "./overview-range";

/** The day the charts highlight: today when the range holds it, else the range's last day. */
export function highlightDay(range: Pick<OverviewRange, "days">, today: CalendarDate): CalendarDate {
  return range.days.includes(today) ? today : range.days[range.days.length - 1]!;
}
