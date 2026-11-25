import { describe, expect, it } from "vitest";
import type { OperatingHoursRow } from "@/features/settings/repositories/settings-repository";
import { DEFAULT_SITE_SETTINGS } from "./default-catalog";
import { availablePickupSlots, collectionTimes, daySlots, isBookableDay, windowLabel, windowSummary } from "./pickup-window";

const HOURS = DEFAULT_SITE_SETTINGS.hours;
const ALL_SLOTS = daySlots("2026-10-02", HOURS);

describe("pickup window (from the operating hours)", () => {
  it("offers 30-minute slots from 8:00 AM to 10:00 PM for the seeded hours", () => {
    expect(ALL_SLOTS).toHaveLength(28);
    expect(ALL_SLOTS[0]).toBe("8:00 AM – 8:30 AM");
    expect(ALL_SLOTS).toContain("12:00 PM – 12:30 PM");
    expect(ALL_SLOTS.at(-1)).toBe("9:30 PM – 10:00 PM");
    expect(windowLabel(HOURS, 5)).toBe("8:00 AM – 10:00 PM");
    expect(windowSummary(HOURS)).toBe("8:00 AM – 10:00 PM");
  });

  const custom = (over: Partial<OperatingHoursRow>, weekday: number): OperatingHoursRow[] => HOURS.map((h) => (h.weekday === weekday ? { ...h, ...over } : h));

  it("builds slots for a custom window, on the half hour", () => {
    // 2026-10-02 is a Friday (weekday 5).
    const hours = custom({ opensAt: 9 * 60 + 30, closesAt: 12 * 60 }, 5);
    expect(daySlots("2026-10-02", hours)).toEqual(["9:30 AM – 10:00 AM", "10:00 AM – 10:30 AM", "10:30 AM – 11:00 AM", "11:00 AM – 11:30 AM", "11:30 AM – 12:00 PM"]);
    expect(windowLabel(hours, 5)).toBe("9:30 AM – 12:00 PM");
    expect(windowSummary(hours)).toBeNull();
    // Other weekdays keep theirs.
    expect(daySlots("2026-10-03", hours)).toHaveLength(28);
  });

  it("has no slots on a closed weekday, and says Closed", () => {
    const hours = custom({ isOpen: false }, 5);
    expect(daySlots("2026-10-02", hours)).toEqual([]);
    expect(windowLabel(hours, 5)).toBe("Closed");
    expect(availablePickupSlots("2026-10-02", new Date("2026-10-01T15:00:00Z"), hours)).toEqual([]);
    expect(isBookableDay("2026-10-02", "PICKUP", new Date("2026-10-01T15:00:00Z"), hours)).toBe(false);
  });

  it("doesn't limit Mail-In days by the hours", () => {
    const hours = custom({ isOpen: false }, 5);
    expect(isBookableDay("2026-10-02", "MAIL_IN", new Date("2026-10-01T15:00:00Z"), hours)).toBe(true);
  });
});

describe("bookable pickup slots and days (New York clock, 2h notice)", () => {
  const at = (iso: string) => new Date(iso);

  it("offers today's slots only if they start at least 2 hours from now", () => {
    // 3:00 PM EDT: every slot before 5:00 PM has started or is under 2 hours away.
    const now = at("2026-10-01T19:00:00Z");
    const today = availablePickupSlots("2026-10-01", now, HOURS);
    expect(today[0]).toBe("5:00 PM – 5:30 PM");
    expect(today).not.toContain("4:30 PM – 5:00 PM");
  });

  it("offers nothing more today once the last slot is within the notice period", () => {
    const now = at("2026-10-02T01:45:00Z"); // 9:45 PM EDT
    expect(availablePickupSlots("2026-10-01", now, HOURS)).toEqual([]);
    expect(isBookableDay("2026-10-01", "PICKUP", now, HOURS)).toBe(false);
    expect(availablePickupSlots("2026-10-02", now, HOURS)).toEqual(ALL_SLOTS);
  });

  it("uses New York's date across midnight, not the viewer's", () => {
    // 11:30 PM Oct 1 in New York (already Oct 2 in UTC).
    const lateNight = at("2026-10-02T03:30:00Z");
    expect(isBookableDay("2026-10-01", "MAIL_IN", lateNight, HOURS)).toBe(true);
    // 12:30 AM Oct 2 in New York, still 9:30 PM Oct 1 in California.
    const pastMidnight = at("2026-10-02T04:30:00Z");
    expect(isBookableDay("2026-10-01", "MAIL_IN", pastMidnight, HOURS)).toBe(false);
    expect(isBookableDay("2026-10-02", "MAIL_IN", pastMidnight, HOURS)).toBe(true);
  });

  it("never offers a past day", () => {
    const now = at("2026-10-01T15:00:00Z");
    expect(availablePickupSlots("2026-09-30", now, HOURS)).toEqual([]);
    expect(isBookableDay("2026-09-30", "MAIL_IN", now, HOURS)).toBe(false);
  });
});

describe("collection times", () => {
  it("turns a booked slot into New York instants, across daylight saving", () => {
    expect(collectionTimes("2026-10-03", "4:30 PM – 5:00 PM")).toEqual({
      startsAt: new Date("2026-10-03T20:30:00Z"), // EDT
      endsAt: new Date("2026-10-03T21:00:00Z"),
    });
    // Nov 1: clocks fell back at 2 AM, so 8 AM is 9 real hours after midnight.
    expect(collectionTimes("2026-11-01", "8:00 AM – 8:30 AM").startsAt).toEqual(new Date("2026-11-01T13:00:00Z"));
    expect(collectionTimes("2026-03-08", "9:30 PM – 10:00 PM").endsAt).toEqual(new Date("2026-03-09T02:00:00Z"));
  });

  it("reads the slot label itself, whatever the hours are", () => {
    expect(collectionTimes("2026-10-03", "3:00 AM – 3:30 AM").startsAt).toEqual(new Date("2026-10-03T07:00:00Z"));
  });

  it("refuses a malformed label", () => {
    for (const slot of ["3:15 AM – 3:50 AM", "nonsense", "13:00 PM – 13:30 PM", "8:00 AM - 8:30 AM", "8:00 AM – 9:00 AM", ""]) {
      expect(() => collectionTimes("2026-10-03", slot)).toThrow();
    }
  });
});
