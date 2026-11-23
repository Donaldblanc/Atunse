// Turning the owner's picked date + slot into a visit's start and end,
// under the owner's rules (adminVisitSlots), for rescheduling a visit and
// booking a Return. Pure: shared by both use-cases and their tests.

import { isCalendarDate } from "./calendar-date";
import { adminVisitSlots, collectionTimes } from "./pickup-window";
import type { OperatingHoursRow } from "@/features/settings/repositories/settings-repository";

/** The date or slot isn't one the owner can book. The message is safe to show. */
export class VisitSlotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VisitSlotError";
  }
}

/**
 * The instants for `date` + `slot` (a slot label), or a
 * VisitSlotError when the day is malformed, the slot isn't on that day's
 * grid per the operating hours, or it has already started. Same hours and
 * 30-minute grid as booking; no customer lead time (see adminVisitSlots).
 */
export function resolveVisitSlot(date: string, slot: string, now: Date, hours: OperatingHoursRow[]): { startsAt: Date; endsAt: Date } {
  if (!isCalendarDate(date)) throw new VisitSlotError("Pick a valid date.");
  if (!adminVisitSlots(date, now, hours).includes(slot)) throw new VisitSlotError("That time isn't available. Pick another.");
  return collectionTimes(date, slot);
}
