import { describe, expect, it } from "vitest";
import { calendarHref, monthGrid, parseMonthParam } from "./calendar-month";

// Tuesday Sep 29, 2026, 10:00 AM in New York (EDT).
const NOW = new Date("2026-09-29T14:00:00Z");

describe("monthGrid", () => {
  it("covers the whole month in full Monday-Sunday weeks", () => {
    // October 2026: Thursday Oct 1 to Saturday Oct 31.
    const grid = monthGrid("2026-10-01");
    expect(grid.month).toBe("2026-10-01");
    expect(grid.nextMonth).toBe("2026-11-01");
    expect(grid.previousMonth).toBe("2026-09-01");
    expect(grid.days.length % 7).toBe(0);
    expect(grid.days[0]).toBe("2026-09-28"); // the Monday of Oct 1's week
    expect(grid.days).toContain("2026-10-01");
    expect(grid.days).toContain("2026-10-31");
    expect(grid.days[grid.days.length - 1]).toBe("2026-11-01"); // the Sunday of Oct 31's week
  });

  it("fills exactly 4 weeks when the month starts on a Monday and ends on a Sunday", () => {
    // February 2027: Monday Feb 1 to Sunday Feb 28.
    const grid = monthGrid("2027-02-01");
    expect(grid.days).toHaveLength(28);
    expect(grid.days[0]).toBe("2027-02-01");
    expect(grid.days[grid.days.length - 1]).toBe("2027-02-28");
  });
});

describe("parseMonthParam", () => {
  it("parses a valid ?month=, falling back to the shop's current month for anything else", () => {
    expect(parseMonthParam("2026-03", NOW)).toBe("2026-03-01");
    expect(parseMonthParam("not-a-month", NOW)).toBe("2026-09-01");
    expect(parseMonthParam(undefined, NOW)).toBe("2026-09-01");
    expect(parseMonthParam(["2026-03"], NOW)).toBe("2026-09-01");
  });

  it("rejects a month number out of range, rather than silently wrapping", () => {
    expect(parseMonthParam("2026-13", NOW)).toBe("2026-09-01");
    expect(parseMonthParam("2026-00", NOW)).toBe("2026-09-01");
  });
});

describe("calendarHref", () => {
  it("drops the param for the current month, and keeps it for any other", () => {
    expect(calendarHref("2026-09-01", NOW)).toBe("/admin/calendar");
    expect(calendarHref("2026-10-01", NOW)).toBe("/admin/calendar?month=2026-10");
  });
});

describe("monthGrid's prev/next links across a year boundary", () => {
  it("steps from December into January of the next year", () => {
    const grid = monthGrid("2026-12-01");
    expect(grid.nextMonth).toBe("2027-01-01");
    expect(calendarHref(grid.nextMonth, NOW)).toBe("/admin/calendar?month=2027-01");
  });

  it("steps from January into December of the previous year", () => {
    const grid = monthGrid("2027-01-01");
    expect(grid.previousMonth).toBe("2026-12-01");
    expect(calendarHref(grid.previousMonth, NOW)).toBe("/admin/calendar?month=2026-12");
  });
});
