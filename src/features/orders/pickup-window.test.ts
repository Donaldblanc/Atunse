import { describe, expect, it } from "vitest";
import { PICKUP_TIME_SLOTS, toCalendarDate } from "./pickup-window";

describe("pickup window", () => {
  it("offers 30-minute slots from 4:30 PM to 10:00 PM", () => {
    expect(PICKUP_TIME_SLOTS).toHaveLength(11);
    expect(PICKUP_TIME_SLOTS[0]).toBe("4:30 PM – 5:00 PM");
    expect(PICKUP_TIME_SLOTS.at(-1)).toBe("9:30 PM – 10:00 PM");
  });

  it("formats the local calendar day, not the UTC one", () => {
    expect(toCalendarDate(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});
