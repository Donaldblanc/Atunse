// The period the admin Overview reports on, in the shop's (New York's)
// days. One range scopes every number on the page, so they always agree.
//
// A range is a preset (`?range=last-week`) or a custom stretch of days
// (`?from=2026-09-01&to=2026-09-14`, both inclusive). Build links that keep
// the range with `overviewHref` / `rangeSearchParams`, so every element that
// adds its own query param (a dialog, a tab) leaves the range intact.

import {
  addDays,
  calendarDateInShopTime,
  calendarDateToUtcMidnight,
  dayOfWeek,
  daysBetween,
  firstOfMonth,
  firstOfNextMonth,
  firstOfPreviousMonth,
  isCalendarDate,
  shopClock,
  shopMidnight,
  shopTime,
  type CalendarDate,
} from "@/features/orders/calendar-date";

export const OVERVIEW_PRESET_IDS = ["this-week", "last-week", "last-30-days", "last-90-days", "this-month", "last-month"] as const;
export type OverviewPresetId = (typeof OVERVIEW_PRESET_IDS)[number];
export type OverviewRangeId = OverviewPresetId | "custom";

export const OVERVIEW_RANGE_LABELS: Record<OverviewRangeId, string> = {
  "this-week": "This Week",
  "last-week": "Last Week",
  "last-30-days": "Last 30 Days",
  "last-90-days": "Last 90 Days",
  "this-month": "This Month",
  "last-month": "Last Month",
  custom: "Custom",
};

export const DEFAULT_OVERVIEW_RANGE: OverviewPresetId = "this-week";

/** A custom range can't be longer than this many days (a leap year), so the chart and queries stay bounded. */
export const MAX_CUSTOM_RANGE_DAYS = 366;

/** What was asked for: a preset, or custom first and last days (inclusive). */
export type OverviewSelection = OverviewPresetId | { from: CalendarDate; to: CalendarDate };

export interface OverviewRange {
  id: OverviewRangeId;
  /** What was asked for, to build links back to this range. */
  selection: OverviewSelection;
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

/** A `?range=` preset, falling back to the default for anything unknown (including "custom", which needs dates). */
export function parseOverviewRangeId(value: string | string[] | undefined): OverviewPresetId {
  return OVERVIEW_PRESET_IDS.find((id) => id === value) ?? DEFAULT_OVERVIEW_RANGE;
}

type SearchParam = string | string[] | undefined;

/**
 * The range a page's query string asks for. A valid preset in `?range=`
 * wins; otherwise `?from=&to=` make a custom range, but only if strictly
 * valid: real dates, in order, no later than today and at most
 * MAX_CUSTOM_RANGE_DAYS long. Anything else falls back to the default,
 * so a hand-edited URL can never break the page or ask for a huge range.
 */
export function parseOverviewSelection(params: { range?: SearchParam; from?: SearchParam; to?: SearchParam }, now: Date): OverviewSelection {
  const { range, from, to } = params;
  const preset = OVERVIEW_PRESET_IDS.find((id) => id === range);
  if (preset) return preset;
  if (typeof from === "string" && typeof to === "string" && isCalendarDate(from) && isCalendarDate(to)) {
    const length = daysBetween(from, to) + 1;
    if (length >= 1 && length <= MAX_CUSTOM_RANGE_DAYS && to <= calendarDateInShopTime(now)) return { from, to };
  }
  return DEFAULT_OVERVIEW_RANGE;
}

/** The query params that select `selection`; none for the default, so its URL stays clean. */
export function rangeSearchParams(selection: OverviewSelection): URLSearchParams {
  const params = new URLSearchParams();
  if (typeof selection === "object") {
    params.set("from", selection.from);
    params.set("to", selection.to);
  } else if (selection !== DEFAULT_OVERVIEW_RANGE) {
    params.set("range", selection);
  }
  return params;
}

/**
 * "/admin?..." for `selection` plus any `extra` params (a dialog's, say).
 * Anything that adds its own query param should build its link with this,
 * so opening or closing it keeps the range.
 */
export function overviewHref(selection: OverviewSelection, extra: Record<string, string> = {}): string {
  const params = rangeSearchParams(selection);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

/** Monday of the week `date` falls in (the shop's weeks run Monday-Sunday). */
function mondayOf(date: CalendarDate): CalendarDate {
  return addDays(date, -((dayOfWeek(date) + 6) % 7));
}

/**
 * A selection's first day, day count and the first day of the period to
 * compare it with. Pure on dates, so the picker can lay out a preset's
 * days without an instant.
 */
function resolve(selection: OverviewSelection, today: CalendarDate) {
  if (typeof selection === "object") {
    const length = daysBetween(selection.from, selection.to) + 1;
    return { id: "custom" as const, first: selection.from, length, previousFirst: addDays(selection.from, -length) };
  }
  const rolling = (length: number, first: CalendarDate) => ({ id: selection, first, length, previousFirst: addDays(first, -length) });
  const month = (first: CalendarDate) => ({
    id: selection,
    first,
    length: daysBetween(first, firstOfNextMonth(first)),
    previousFirst: firstOfPreviousMonth(first),
  });
  switch (selection) {
    case "this-week":
      return rolling(7, mondayOf(today));
    case "last-week":
      return rolling(7, addDays(mondayOf(today), -7));
    case "last-30-days":
      return rolling(30, addDays(today, -29));
    case "last-90-days":
      return rolling(90, addDays(today, -89));
    case "this-month":
      return month(firstOfMonth(today));
    case "last-month":
      return month(firstOfPreviousMonth(today));
  }
}

/** Every day a selection covers (oldest first), given the shop's today. */
export function rangeDays(selection: OverviewSelection, today: CalendarDate): CalendarDate[] {
  const { first, length } = resolve(selection, today);
  return Array.from({ length }, (_, i) => addDays(first, i));
}

const COMPARISON_LABELS: Record<OverviewRangeId, string> = {
  "this-week": "vs same time last week",
  "last-week": "vs the week before",
  "last-30-days": "vs the 30 days before",
  "last-90-days": "vs the 90 days before",
  "this-month": "vs same time last month",
  "last-month": "vs the month before",
  custom: "vs previous period",
};

/** `selection` must already be valid (see parseOverviewSelection); a preset alone always is. */
export function overviewRange(selection: OverviewSelection, now: Date): OverviewRange {
  const today = calendarDateInShopTime(now);
  const { id, first, length, previousFirst } = resolve(selection, today);
  const days = Array.from({ length }, (_, i) => addDays(first, i));

  const start = shopMidnight(first);
  const rangeEnd = shopMidnight(addDays(first, length));
  const inProgress = now < rangeEnd;
  const end = inProgress ? now : rangeEnd;

  // A range still in progress is compared with the same elapsed stretch of
  // the one before (Monday to this time last Tuesday, say), not the whole
  // of it, so a Tuesday never looks like a bad week. It's counted in shop
  // days and clock time, so a DST change can't shift it, and capped at the
  // range's start: a longer month has no counterpart for its last days.
  const previousStart = shopMidnight(previousFirst);
  const sameTimeBefore = shopTime(addDays(previousFirst, daysBetween(first, today)), shopClock(now).minutes);
  const previousEnd = inProgress && sameTimeBefore < start ? sameTimeBefore : start;

  return { id, selection, days, start, end, previous: { start: previousStart, end: previousEnd }, comparisonLabel: COMPARISON_LABELS[id] };
}

const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "Sep 28 – Oct 4, 2026"; both years when the range spans two ("Dec 20, 2025 – Jan 5, 2026"). */
export function formatRangeDates(range: OverviewRange): string {
  const first = range.days[0]!;
  const last = range.days[range.days.length - 1]!;
  const format = (date: CalendarDate) => dayFormat.format(calendarDateToUtcMidnight(date));
  const firstYear = first.slice(0, 4) === last.slice(0, 4) ? "" : `, ${first.slice(0, 4)}`;
  return `${format(first)}${firstYear} – ${format(last)}, ${last.slice(0, 4)}`;
}
