import { describe, expect, it } from "vitest";
import {
  calendarDateFromUtcMidnight,
  calendarDateInLocalTime,
  calendarDateInShopTime,
  calendarDateToUtcMidnight,
  isCalendarDate,
  localDateFromCalendarDate,
  shopClock,
} from "./calendar-date";

describe("calendar dates", () => {
  it("validates real YYYY-MM-DD days only", () => {
    expect(isCalendarDate("2026-10-03")).toBe(true);
    expect(isCalendarDate("2026-02-29")).toBe(false); // not a leap year
    expect(isCalendarDate("2026-2-3")).toBe(false);
    expect(isCalendarDate("tomorrow")).toBe(false);
  });

  it("round-trips through the database's UTC midnight without shifting", () => {
    expect(calendarDateToUtcMidnight("2026-10-03").toISOString()).toBe("2026-10-03T00:00:00.000Z");
    expect(calendarDateFromUtcMidnight(new Date("2026-10-03T00:00:00Z"))).toBe("2026-10-03");
  });

  it("reads a browser-local Date as the day the browser shows, not the UTC one", () => {
    expect(calendarDateInLocalTime(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
    expect(calendarDateInLocalTime(localDateFromCalendarDate("2026-01-05"))).toBe("2026-01-05");
  });

  it("takes 'today' from New York, across the midnight boundary", () => {
    // 11:30 PM Oct 1 in New York is already Oct 2 in UTC.
    expect(calendarDateInShopTime(new Date("2026-10-02T03:30:00Z"))).toBe("2026-10-01");
    // 12:30 AM Oct 2 in New York (still 9:30 PM Oct 1 in California).
    expect(calendarDateInShopTime(new Date("2026-10-02T04:30:00Z"))).toBe("2026-10-02");
  });

  it("gives New York's minutes past midnight, including daylight saving", () => {
    expect(shopClock(new Date("2026-10-01T19:00:00Z"))).toEqual({ date: "2026-10-01", minutes: 15 * 60 }); // EDT
    expect(shopClock(new Date("2026-12-01T20:00:00Z"))).toEqual({ date: "2026-12-01", minutes: 15 * 60 }); // EST
    expect(shopClock(new Date("2026-10-02T04:00:00Z"))).toEqual({ date: "2026-10-02", minutes: 0 });
  });
});
