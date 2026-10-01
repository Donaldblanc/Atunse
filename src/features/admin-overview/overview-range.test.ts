import { describe, expect, it } from "vitest";
import { formatRangeDates, overviewRange, parseOverviewRangeId } from "./overview-range";

// Tuesday Sep 29, 2026, 10:00 AM in New York (EDT).
const NOW = new Date("2026-09-29T14:00:00Z");

describe("overview range", () => {
  it("parses ?range=, defaulting to this week", () => {
    expect(parseOverviewRangeId("last-30-days")).toBe("last-30-days");
    expect(parseOverviewRangeId(undefined)).toBe("this-week");
    expect(parseOverviewRangeId("forever")).toBe("this-week");
    expect(parseOverviewRangeId(["last-week"])).toBe("this-week");
  });

  it("runs this week Monday to Sunday, counting up to now against the same stretch of last week", () => {
    const range = overviewRange("this-week", NOW);
    expect(range.days).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(range.start.toISOString()).toBe("2026-09-28T04:00:00.000Z");
    expect(range.end).toEqual(NOW);
    expect(range.previous.start.toISOString()).toBe("2026-09-21T04:00:00.000Z");
    expect(range.previous.end.toISOString()).toBe("2026-09-22T14:00:00.000Z"); // last Tuesday, 10 AM
    expect(formatRangeDates(range)).toBe("Sep 28 – Oct 4, 2026");
  });

  it("compares a finished week with the whole week before it", () => {
    const range = overviewRange("last-week", NOW);
    expect(range.days[0]).toBe("2026-09-21");
    expect(range.days[6]).toBe("2026-09-27");
    expect(range.end.toISOString()).toBe("2026-09-28T04:00:00.000Z");
    expect(range.previous).toEqual({ start: new Date("2026-09-14T04:00:00Z"), end: range.start });
  });

  it("covers the last 30 days including today", () => {
    const range = overviewRange("last-30-days", NOW);
    expect(range.days).toHaveLength(30);
    expect(range.days[0]).toBe("2026-08-31");
    expect(range.days[29]).toBe("2026-09-29");
    expect(range.previous.start.toISOString()).toBe("2026-08-01T04:00:00.000Z");
  });

  it("takes the week from New York's date, not UTC's", () => {
    // Sunday Oct 4, 11:30 PM in New York is already Monday in UTC.
    const range = overviewRange("this-week", new Date("2026-10-05T03:30:00Z"));
    expect(range.days[0]).toBe("2026-09-28");
  });
});
