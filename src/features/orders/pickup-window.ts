// Pickup rules: the server's submitOrder validation owns them, and the
// booking UI (pickup-date-picker.tsx, schedule-step.tsx) imports them, so
// the two can't disagree about which slots or states exist. They live in
// features/orders, next to service-catalog.ts, so a UI refactor can't
// silently change server validation. Pure: no React.

/** CONTEXT.md: Pickup is local to the NY/NJ/CT Tri-State area only. */
export const PICKUP_STATES = ["NY", "NJ", "CT"] as const;

// Pickup window: 4:30 PM - 10:00 PM in 30-minute slots.
const WINDOW_START_MINUTES = 16 * 60 + 30;
const WINDOW_END_MINUTES = 22 * 60;

function formatClock(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m === 0 ? "00" : m} ${period}`;
}

function buildTimeSlots() {
  const slots: string[] = [];
  for (let start = WINDOW_START_MINUTES; start < WINDOW_END_MINUTES; start += 30) {
    slots.push(`${formatClock(start)} – ${formatClock(start + 30)}`);
  }
  return slots;
}

export const PICKUP_TIME_SLOTS: readonly string[] = buildTimeSlots();

/** A local calendar day as "YYYY-MM-DD" (no UTC conversion). */
export function toCalendarDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Mail-In is nationwide: the 50 states plus DC. */
export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
  "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC",
  "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;
