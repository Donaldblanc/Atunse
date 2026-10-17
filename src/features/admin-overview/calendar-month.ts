// Month-grid date math for the admin Calendar screen (/admin/calendar).
// Mirrors overview-range.ts's week math, but for a full Monday-Sunday
// grid around a month rather than a reporting range.

import { addDays, calendarDateInShopTime, dayOfWeek, firstOfMonth, firstOfNextMonth, firstOfPreviousMonth, isCalendarDate, type CalendarDate } from "@/features/orders/calendar-date";

/** Monday of the week `date` falls in (the shop's weeks run Monday-Sunday). */
function mondayOf(date: CalendarDate): CalendarDate {
  return addDays(date, -((dayOfWeek(date) + 6) % 7));
}

export interface MonthGrid {
  /** The first of the shown month. */
  month: CalendarDate;
  /** The first of the month after it, for the "next" link. */
  nextMonth: CalendarDate;
  /** The first of the month before it, for the "previous" link. */
  previousMonth: CalendarDate;
  /** Every day shown, Monday-Sunday, in full weeks of 7: the month's own
   *  days plus whichever neighbouring days fill its first and last weeks. */
  days: CalendarDate[];
}

/** A full-week grid covering every day of `month`. */
export function monthGrid(month: CalendarDate): MonthGrid {
  const first = firstOfMonth(month);
  const nextMonth = firstOfNextMonth(first);
  const last = addDays(nextMonth, -1);
  const start = mondayOf(first);
  const end = addDays(mondayOf(last), 7); // exclusive: the Monday after the last week shown
  const days: CalendarDate[] = [];
  for (let d = start; d < end; d = addDays(d, 1)) days.push(d);
  return { month: first, nextMonth, previousMonth: firstOfPreviousMonth(first), days };
}

/** `?month=YYYY-MM`, falling back to the shop's current month for anything missing or invalid (e.g. "2026-13"). */
export function parseMonthParam(value: string | string[] | undefined, now: Date): CalendarDate {
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) {
    const candidate = `${value}-01`;
    if (isCalendarDate(candidate)) return candidate;
  }
  return firstOfMonth(calendarDateInShopTime(now));
}

/** "/admin/calendar?month=YYYY-MM" for `month`, dropping the param for the shop's current month. */
export function calendarHref(month: CalendarDate, now: Date): string {
  const current = firstOfMonth(calendarDateInShopTime(now));
  return month === current ? "/admin/calendar" : `/admin/calendar?month=${month.slice(0, 7)}`;
}

/**
 * `?calendarMonth=YYYY-MM` carried by a dialog opened from the Calendar
 * screen (a visit link, say), so closing or rescheduling it returns there
 * instead of dropping the admin on the Overview. Same format as `?month=`.
 */
export function calendarMonthParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value) && isCalendarDate(`${value}-01`)) return value;
  return null;
}
