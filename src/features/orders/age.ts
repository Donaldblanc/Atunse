import { calendarDateInShopTime } from "./calendar-date";

/** Customers must be this old to book. */
export const MINIMUM_BOOKING_AGE = 18;

export const AGE_REQUIREMENT_MESSAGE = "You need to be 18 or older to book. A parent or guardian can book for you.";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Valid month (1-12) and a plausible year (an integer, not in the future, within 120 years). */
export function isBirthMonthYear(month: unknown, year: unknown, now: Date): boolean {
  if (typeof month !== "number" || typeof year !== "number") return false;
  if (!Number.isInteger(month) || !Number.isInteger(year) || month < 1 || month > 12) return false;
  const shopYear = Number(calendarDateInShopTime(now).slice(0, 4));
  return year <= shopYear && year >= shopYear - 120;
}

/**
 * Conservative, month precision: eligible only when the birth month is at
 * least 18 full years before the current month (shop time), so someone born
 * this month 18 years ago isn't yet counted. We ask no day of birth.
 * Used by the booking form and submitOrder alike.
 */
export function isAdultByBirthMonth(birthMonth: number, birthYear: number, now: Date): boolean {
  const today = calendarDateInShopTime(now);
  const nowYear = Number(today.slice(0, 4));
  const nowMonth = Number(today.slice(5, 7));
  return birthYear * 12 + birthMonth <= (nowYear - MINIMUM_BOOKING_AGE) * 12 + nowMonth - 1;
}

/** "Mar 1990", or null for an Order from before the age check. */
export function formatBirthMonthYear(month: number | null, year: number | null): string | null {
  if (month === null || year === null) return null;
  return `${MONTH_NAMES[month - 1]!.slice(0, 3)} ${year}`;
}

/** Years offered in the booking form: this year back 100, newest first. */
export function birthYearOptions(now: Date): number[] {
  const nowYear = Number(calendarDateInShopTime(now).slice(0, 4));
  return Array.from({ length: 101 }, (_, i) => nowYear - i);
}
