// Pickup rules: the server's submitOrder validation owns them, and the
// booking UI (pickup-date-picker.tsx, schedule-step.tsx) imports them, so
// the two can't disagree about which slots or states exist. They live in
// features/orders, next to service-catalog.ts, so a UI refactor can't
// silently change server validation. Pure: no React.

import { shopClock, type CalendarDate } from "./calendar-date";

/** CONTEXT.md: Pickup is local to the NY/NJ/CT Tri-State area only. */
export const PICKUP_STATES = ["NY", "NJ", "CT"] as const;

// Pickup window: 8:00 AM - 10:00 PM in 30-minute slots.
const WINDOW_START_MINUTES = 8 * 60;
const WINDOW_END_MINUTES = 22 * 60;

function formatClock(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m === 0 ? "00" : m} ${period}`;
}

/**
 * Notice a same-day pickup needs: a slot is bookable only if it starts at
 * least this long after now, in New York time, so the shop can see the
 * booking and plan the route (#75).
 */
export const PICKUP_LEAD_MINUTES = 2 * 60;

type PickupSlot = { label: string; startMinutes: number };

function buildTimeSlots(): PickupSlot[] {
  const slots: PickupSlot[] = [];
  for (let start = WINDOW_START_MINUTES; start < WINDOW_END_MINUTES; start += 30) {
    slots.push({ label: `${formatClock(start)} – ${formatClock(start + 30)}`, startMinutes: start });
  }
  return slots;
}

const SLOTS = buildTimeSlots();

/** The daily window as customers read it, e.g. "8:00 AM – 10:00 PM". */
export const PICKUP_WINDOW_LABEL = `${formatClock(WINDOW_START_MINUTES)} – ${formatClock(WINDOW_END_MINUTES)}`;

/** Every slot in the daily window, bookable or not. */
export const PICKUP_TIME_SLOTS: readonly string[] = SLOTS.map((slot) => slot.label);

/**
 * The slots a customer can still book on `date`, at instant `now`. The
 * shop's (New York's) clock decides, on client and server alike: none for
 * a past date, all for a future one, and on today only those starting at
 * least PICKUP_LEAD_MINUTES from now.
 */
export function availablePickupSlots(date: CalendarDate, now: Date): string[] {
  const clock = shopClock(now);
  if (date < clock.date) return [];
  if (date > clock.date) return SLOTS.map((slot) => slot.label);
  return SLOTS.filter((slot) => slot.startMinutes >= clock.minutes + PICKUP_LEAD_MINUTES).map((slot) => slot.label);
}

/**
 * Whether a calendar day can be picked: from the shop's today onward, and
 * for Pickup only while that day still has a bookable slot.
 */
export function isBookableDay(date: CalendarDate, method: "PICKUP" | "MAIL_IN", now: Date): boolean {
  if (method === "PICKUP") return availablePickupSlots(date, now).length > 0;
  return date >= shopClock(now).date;
}

/** Mail-In is nationwide: the 50 states plus DC. */
export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
  "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC",
  "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;
