// The period the admin Overview reports on, in the shop's (New York's)
// days. One range scopes every number on the page, so they always agree.

import { addDays, calendarDateInShopTime, dayOfWeek, shopMidnight, type CalendarDate } from "@/features/orders/calendar-date";

export const OVERVIEW_RANGE_IDS = ["this-week", "last-week", "last-30-days"] as const;
export type OverviewRangeId = (typeof OVERVIEW_RANGE_IDS)[number];

export const OVERVIEW_RANGE_LABELS: Record<OverviewRangeId, string> = {
  "this-week": "This week",
  "last-week": "Last week",
  "last-30-days": "Last 30 days",
};

export const DEFAULT_OVERVIEW_RANGE: OverviewRangeId = "this-week";

export interface OverviewRange {
  id: OverviewRangeId;
  /** Every day in the range, oldest first (Monday-Sunday for a week). */
  days: CalendarDate[];
  /** What's counted: [start, end), where end stops at "now" for a range still in progress. */
  start: Date;
  end: Date;
  /** The same stretch of the period before, for the "vs" deltas. */
  previous: { start: Date; end: Date };
  /** e.g. "vs same time last week". */
  comparisonLabel: string;
}

/** A `?range=` value, falling back to the default for anything unknown. */
export function parseOverviewRangeId(value: string | string[] | undefined): OverviewRangeId {
  return OVERVIEW_RANGE_IDS.find((id) => id === value) ?? DEFAULT_OVERVIEW_RANGE;
}

/** Monday of the week `date` falls in (the shop's weeks run Monday-Sunday). */
function mondayOf(date: CalendarDate): CalendarDate {
  return addDays(date, -((dayOfWeek(date) + 6) % 7));
}

export function overviewRange(id: OverviewRangeId, now: Date): OverviewRange {
  const today = calendarDateInShopTime(now);
  const first =
    id === "this-week" ? mondayOf(today) : id === "last-week" ? addDays(mondayOf(today), -7) : addDays(today, -29);
  const length = id === "last-30-days" ? 30 : 7;
  const days = Array.from({ length }, (_, i) => addDays(first, i));

  const start = shopMidnight(first);
  const rangeEnd = shopMidnight(addDays(first, length));
  const inProgress = now < rangeEnd;
  const end = inProgress ? now : rangeEnd;

  // A range still in progress is compared with the same elapsed stretch of
  // the one before (Monday to this time last Tuesday, say), not the whole
  // of it, so a Tuesday never looks like a bad week.
  const previousStart = shopMidnight(addDays(first, -length));
  const previousEnd = inProgress
    ? new Date(shopMidnight(addDays(today, -length)).getTime() + (now.getTime() - shopMidnight(today).getTime()))
    : start;

  const comparisonLabel = {
    "this-week": "vs same time last week",
    "last-week": "vs the week before",
    "last-30-days": "vs the 30 days before",
  }[id];

  return { id, days, start, end, previous: { start: previousStart, end: previousEnd }, comparisonLabel };
}

const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "Sep 28 – Oct 4, 2026". */
export function formatRangeDates(range: OverviewRange): string {
  const first = range.days[0]!;
  const last = range.days[range.days.length - 1]!;
  const format = (date: CalendarDate) => dayFormat.format(new Date(`${date}T00:00:00Z`));
  return `${format(first)} – ${format(last)}, ${last.slice(0, 4)}`;
}
