import { describe, expect, it } from "vitest";
import { availablePickupSlots, isBookableDay, PICKUP_TIME_SLOTS } from "./pickup-window";

describe("pickup window", () => {
  it("offers 30-minute slots from 4:30 PM to 10:00 PM", () => {
    expect(PICKUP_TIME_SLOTS).toHaveLength(11);
    expect(PICKUP_TIME_SLOTS[0]).toBe("4:30 PM – 5:00 PM");
    expect(PICKUP_TIME_SLOTS.at(-1)).toBe("9:30 PM – 10:00 PM");
  });
});

describe("bookable pickup slots and days (New York clock, 2h notice)", () => {
  const at = (iso: string) => new Date(iso);

  it("offers today's slots only if they start at least 2 hours from now", () => {
    // 3:00 PM EDT: the 4:30 and 4:30–5:00 slots are under 2 hours away.
    const now = at("2026-10-01T19:00:00Z");
    const today = availablePickupSlots("2026-10-01", now);
    expect(today[0]).toBe("5:00 PM – 5:30 PM");
    expect(today).not.toContain("4:30 PM – 5:00 PM");
  });

  it("offers nothing more today once the last slot is within the notice period", () => {
    const now = at("2026-10-02T01:45:00Z"); // 9:45 PM EDT
    expect(availablePickupSlots("2026-10-01", now)).toEqual([]);
    expect(isBookableDay("2026-10-01", "PICKUP", now)).toBe(false);
    expect(availablePickupSlots("2026-10-02", now)).toEqual(PICKUP_TIME_SLOTS);
  });

  it("uses New York's date across midnight, not the viewer's", () => {
    // 11:30 PM Oct 1 in New York (already Oct 2 in UTC).
    const lateNight = at("2026-10-02T03:30:00Z");
    expect(isBookableDay("2026-10-01", "MAIL_IN", lateNight)).toBe(true);
    // 12:30 AM Oct 2 in New York, still 9:30 PM Oct 1 in California.
    const pastMidnight = at("2026-10-02T04:30:00Z");
    expect(isBookableDay("2026-10-01", "MAIL_IN", pastMidnight)).toBe(false);
    expect(isBookableDay("2026-10-02", "MAIL_IN", pastMidnight)).toBe(true);
  });

  it("never offers a past day", () => {
    const now = at("2026-10-01T15:00:00Z");
    expect(availablePickupSlots("2026-09-30", now)).toEqual([]);
    expect(isBookableDay("2026-09-30", "MAIL_IN", now)).toBe(false);
  });
});
