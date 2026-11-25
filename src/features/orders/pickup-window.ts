// Pickup rules: the server's submitOrder validation owns them, and the
// booking UI (pickup-date-picker.tsx, schedule-step.tsx) imports them, so
// the two can't disagree about which slots or states exist. They live in
// features/orders, next to service-catalog.ts, so a UI refactor can't
// silently change server validation. Pure: no React. The collection hours
// are Settings' operating hours, passed in by the caller (ADR-0016).

import type { OperatingHoursRow } from "@/features/settings/repositories/settings-repository";
import { dayOfWeek, shopClock, shopTime, type CalendarDate } from "./calendar-date";

/** CONTEXT.md: Pickup is local to the NY/NJ/CT Tri-State area only. */
export const PICKUP_STATES = ["NY", "NJ", "CT"] as const;

const SLOT_MINUTES = 30;

function formatClock(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m === 0 ? "00" : String(m).padStart(2, "0")} ${period}`;
}

/**
 * Notice a same-day pickup needs: a slot is bookable only if it starts at
 * least this long after now, in New York time, so the shop can see the
 * booking and plan the route (#75).
 */
export const PICKUP_LEAD_MINUTES = 2 * 60;

type PickupSlot = { label: string; startMinutes: number };

/** The 30-minute slots of `date`'s weekday, from opening up to closing; none on a closed day. */
function slotsFor(date: CalendarDate, hours: OperatingHoursRow[]): PickupSlot[] {
  const row = hours.find((h) => h.weekday === dayOfWeek(date));
  if (!row || !row.isOpen) return [];
  const slots: PickupSlot[] = [];
  for (let start = row.opensAt; start + SLOT_MINUTES <= row.closesAt; start += SLOT_MINUTES) {
    slots.push({ label: `${formatClock(start)} – ${formatClock(start + SLOT_MINUTES)}`, startMinutes: start });
  }
  return slots;
}

/** Every slot on `date` per the operating hours, bookable or not. */
export function daySlots(date: CalendarDate, hours: OperatingHoursRow[]): string[] {
  return slotsFor(date, hours).map((slot) => slot.label);
}

/** A weekday's hours as customers read them, e.g. "8:00 AM – 10:00 PM", or "Closed". */
export function windowLabel(hours: OperatingHoursRow[], weekday: number): string {
  const row = hours.find((h) => h.weekday === weekday);
  if (!row || !row.isOpen || row.closesAt <= row.opensAt) return "Closed";
  return `${formatClock(row.opensAt)} – ${formatClock(row.closesAt)}`;
}

/**
 * The collection hours when every open weekday has the same ("8:00 AM – 10:00 PM"),
 * so the booking page can state them once; null when they differ by day or the shop is closed all week.
 */
export function windowSummary(hours: OperatingHoursRow[]): string | null {
  const labels = new Set(hours.filter((h) => h.isOpen).map((h) => windowLabel(hours, h.weekday)));
  return labels.size === 1 ? [...labels][0]! : null;
}

function parseClock(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(text);
  if (!match) return null;
  const hour12 = Number(match[1]);
  const minute = Number(match[2]);
  if (hour12 < 1 || hour12 > 12 || minute > 59) return null;
  return (hour12 % 12) * 60 + (match[3] === "PM" ? 12 * 60 : 0) + minute;
}

/**
 * When a booked collection slot starts and ends, as instants: the
 * Calendar's COLLECTION Appointment. Parsed from the slot label itself, so
 * it never depends on the current hours (a booked slot stays readable after
 * the shop changes them). Throws for a label that isn't a 30-minute slot
 * (submitOrder has already validated it).
 */
export function collectionTimes(date: CalendarDate, slot: string): { startsAt: Date; endsAt: Date } {
  const [from, to, ...rest] = slot.split(" – ");
  const start = from === undefined ? null : parseClock(from);
  const end = to === undefined ? null : parseClock(to);
  if (rest.length > 0 || start === null || end === null || end - start !== SLOT_MINUTES) {
    throw new Error(`Unknown collection slot: ${slot}`);
  }
  return { startsAt: shopTime(date, start), endsAt: shopTime(date, end) };
}

/**
 * The slots a customer can still book on `date`, at instant `now`. The
 * shop's (New York's) clock decides, on client and server alike: none for
 * a past date, all for a future one, and on today only those starting at
 * least PICKUP_LEAD_MINUTES from now.
 */
export function availablePickupSlots(date: CalendarDate, now: Date, hours: OperatingHoursRow[]): string[] {
  const clock = shopClock(now);
  if (date < clock.date) return [];
  const slots = slotsFor(date, hours);
  if (date > clock.date) return slots.map((slot) => slot.label);
  return slots.filter((slot) => slot.startMinutes >= clock.minutes + PICKUP_LEAD_MINUTES).map((slot) => slot.label);
}

/**
 * The slots the owner can book a visit into on `date`, at instant `now`
 * (rescheduling a Collection, booking a Return). The same hours and slot
 * grid as customers get, but WITHOUT the customer lead time: the lead time
 * exists so the owner can plan a route around a booking, and here the owner
 * is the one planning. A slot that has already started is still refused,
 * so today offers the slots from now on.
 */
export function adminVisitSlots(date: CalendarDate, now: Date, hours: OperatingHoursRow[]): string[] {
  const clock = shopClock(now);
  if (date < clock.date) return [];
  const slots = slotsFor(date, hours);
  if (date > clock.date) return slots.map((slot) => slot.label);
  return slots.filter((slot) => slot.startMinutes >= clock.minutes).map((slot) => slot.label);
}

/**
 * Whether a calendar day can be picked: from the shop's today onward, and
 * for Pickup only while that day still has a bookable slot. Mail-In days
 * aren't limited by the operating hours.
 */
export function isBookableDay(date: CalendarDate, method: "PICKUP" | "MAIL_IN", now: Date, hours: OperatingHoursRow[]): boolean {
  if (method === "PICKUP") return availablePickupSlots(date, now, hours).length > 0;
  return date >= shopClock(now).date;
}

/** Mail-In is nationwide: the 50 states plus DC. */
export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
  "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC",
  "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;
