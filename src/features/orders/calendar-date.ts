// Calendar dates (pickup date, preferred mail-in date) travel and are
// stored as "YYYY-MM-DD": a day, with no time or timezone attached, so it
// can't shift. Every conversion to or from a Date lives here, and each
// name says which timezone it uses; mixing them up moves dates by a day.

/** A calendar day as "YYYY-MM-DD". */
export type CalendarDate = string;

/** The shop runs on New York time: its "today" is New York's. */
export const SHOP_TIMEZONE = "America/New_York";

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" naming a day that exists (rejects e.g. 2026-02-30). */
export function isCalendarDate(value: string): value is CalendarDate {
  if (!CALENDAR_DATE_PATTERN.test(value)) return false;
  const parsed = calendarDateToUtcMidnight(value);
  return !Number.isNaN(parsed.getTime()) && calendarDateFromUtcMidnight(parsed) === value;
}

/** For Postgres DATE columns, which Prisma reads and writes as UTC midnight. */
export function calendarDateToUtcMidnight(date: CalendarDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** Inverse of calendarDateToUtcMidnight. */
export function calendarDateFromUtcMidnight(date: Date): CalendarDate {
  return date.toISOString().slice(0, 10);
}

/** The day a browser-local Date falls on, e.g. a calendar cell the customer picked. */
export function calendarDateInLocalTime(date: Date): CalendarDate {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The inverse, for showing a CalendarDate in a browser-local calendar. */
export function localDateFromCalendarDate(date: CalendarDate): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

const shopParts = new Intl.DateTimeFormat("en-US", {
  timeZone: SHOP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The shop's (New York's) date and minutes past midnight at an instant. */
export function shopClock(instant: Date): { date: CalendarDate; minutes: number } {
  const parts = Object.fromEntries(shopParts.formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** The shop's (New York's) date at an instant: "today" for booking rules. */
export function calendarDateInShopTime(instant: Date): CalendarDate {
  return shopClock(instant).date;
}
