import { describe, expect, it } from "vitest";
import {
  formatRangeDates,
  overviewHref,
  overviewRange,
  parseOverviewRangeId,
  parseOverviewSelection,
  rangeDays,
  rangeSearchParams,
} from "./overview-range";

// Tuesday Sep 29, 2026, 10:00 AM in New York (EDT).
const NOW = new Date("2026-09-29T14:00:00Z");

describe("overview range: 90 days, months and custom ranges", () => {
  it("parses the new presets, but not custom without dates", () => {
    expect(parseOverviewRangeId("last-90-days")).toBe("last-90-days");
    expect(parseOverviewRangeId("this-month")).toBe("this-month");
    expect(parseOverviewRangeId("custom")).toBe("this-week");
  });

  it("covers the last 90 days including today, against the 90 before", () => {
    const range = overviewRange("last-90-days", NOW);
    expect(range.days).toHaveLength(90);
    expect(range.days[0]).toBe("2026-07-02");
    expect(range.days[89]).toBe("2026-09-29");
    expect(range.previous.start.toISOString()).toBe("2026-04-03T04:00:00.000Z");
    expect(range.comparisonLabel).toBe("vs the 90 days before");
    expect(formatRangeDates(range)).toBe("Jul 2 – Sep 29, 2026");
  });

  describe("months", () => {
    it("counts this month up to now against the same stretch of last month", () => {
      const range = overviewRange("this-month", NOW);
      expect(range.days).toHaveLength(30);
      expect(range.days[0]).toBe("2026-09-01");
      expect(range.days[29]).toBe("2026-09-30");
      expect(range.end).toEqual(NOW);
      expect(range.previous.start.toISOString()).toBe("2026-08-01T04:00:00.000Z");
      expect(range.previous.end.toISOString()).toBe("2026-08-29T14:00:00.000Z"); // the 29th, 10 AM
      expect(range.comparisonLabel).toBe("vs same time last month");
    });

    it("compares a finished month with the whole month before it", () => {
      const range = overviewRange("last-month", NOW);
      expect(range.days).toHaveLength(31);
      expect(range.days[0]).toBe("2026-08-01");
      expect(range.end.toISOString()).toBe("2026-09-01T04:00:00.000Z");
      expect(range.previous).toEqual({ start: new Date("2026-07-01T04:00:00Z"), end: range.start });
      expect(range.comparisonLabel).toBe("vs the month before");
    });

    it("caps the comparison at the month's start when the previous month is shorter", () => {
      // Mar 31 has no Feb 31: the stretch to compare is all of February.
      const range = overviewRange("this-month", new Date("2026-03-31T14:00:00Z"));
      expect(range.previous.start.toISOString()).toBe("2026-02-01T05:00:00.000Z");
      expect(range.previous.end).toEqual(range.start);
    });

    it("knows leap Februaries", () => {
      expect(overviewRange("last-month", new Date("2028-03-15T16:00:00Z")).days).toHaveLength(29);
      expect(overviewRange("last-month", new Date("2026-03-15T16:00:00Z")).days).toHaveLength(28);
      expect(overviewRange("this-month", new Date("2028-02-10T16:00:00Z")).days).toHaveLength(29);
    });

    it("rolls last month back over a year boundary", () => {
      const range = overviewRange("last-month", new Date("2027-01-10T16:00:00Z"));
      expect(range.days[0]).toBe("2026-12-01");
      expect(range.days[30]).toBe("2026-12-31");
      expect(range.previous.start.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    });
  });

  it("keeps the in-progress comparison on the shop's clock across a DST change", () => {
    // Wednesday Mar 11 2026, 10 AM EDT. Last week's Wednesday, Mar 4, was still EST.
    const range = overviewRange("this-week", new Date("2026-03-11T14:00:00Z"));
    expect(range.start.toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(range.previous.start.toISOString()).toBe("2026-03-02T05:00:00.000Z");
    expect(range.previous.end.toISOString()).toBe("2026-03-04T15:00:00.000Z"); // 10 AM EST
  });

  describe("custom ranges", () => {
    it("covers the days chosen, inclusive, against the same length before", () => {
      const range = overviewRange({ from: "2026-09-01", to: "2026-09-14" }, NOW);
      expect(range.id).toBe("custom");
      expect(range.days).toHaveLength(14);
      expect(range.days[13]).toBe("2026-09-14");
      expect(range.start.toISOString()).toBe("2026-09-01T04:00:00.000Z");
      expect(range.end.toISOString()).toBe("2026-09-15T04:00:00.000Z");
      expect(range.previous).toEqual({ start: new Date("2026-08-18T04:00:00Z"), end: range.start });
      expect(range.comparisonLabel).toBe("vs previous period");
    });

    it("is one day when from and to match", () => {
      const range = overviewRange({ from: "2026-09-10", to: "2026-09-10" }, NOW);
      expect(range.days).toEqual(["2026-09-10"]);
      expect(range.previous.start.toISOString()).toBe("2026-09-09T04:00:00.000Z");
    });

    it("counts a range that ends today up to now, against the same elapsed stretch", () => {
      const range = overviewRange({ from: "2026-09-23", to: "2026-09-29" }, NOW);
      expect(range.end).toEqual(NOW);
      expect(range.previous.start.toISOString()).toBe("2026-09-16T04:00:00.000Z");
      expect(range.previous.end.toISOString()).toBe("2026-09-22T14:00:00.000Z");
    });

    it("names both years when it spans a new year", () => {
      const range = overviewRange({ from: "2025-12-20", to: "2026-01-05" }, NOW);
      expect(formatRangeDates(range)).toBe("Dec 20, 2025 – Jan 5, 2026");
      expect(range.days).toHaveLength(17);
    });
  });

  describe("parsing ?range=, ?from= and ?to=", () => {
    const parse = (params: Record<string, string | string[] | undefined>) => parseOverviewSelection(params, NOW);

    it("prefers a valid preset, then a valid custom range, then the default", () => {
      expect(parse({ range: "last-month" })).toBe("last-month");
      expect(parse({ range: "last-month", from: "2026-09-01", to: "2026-09-05" })).toBe("last-month");
      expect(parse({ from: "2026-09-01", to: "2026-09-05" })).toEqual({ from: "2026-09-01", to: "2026-09-05" });
      expect(parse({})).toBe("this-week");
    });

    it("accepts a range ending today and one of exactly 366 days", () => {
      expect(parse({ from: "2026-09-29", to: "2026-09-29" })).toEqual({ from: "2026-09-29", to: "2026-09-29" });
      expect(parse({ from: "2025-09-29", to: "2026-09-29" })).toEqual({ from: "2025-09-29", to: "2026-09-29" });
    });

    it.each([
      ["a missing end", { from: "2026-09-01" }],
      ["a missing start", { to: "2026-09-05" }],
      ["a reversed range", { from: "2026-09-05", to: "2026-09-01" }],
      ["a day that does not exist", { from: "2026-02-30", to: "2026-03-05" }],
      ["a malformed date", { from: "9/1/2026", to: "2026-09-05" }],
      ["an end in the future", { from: "2026-09-20", to: "2026-09-30" }],
      ["more than 366 days", { from: "2025-09-28", to: "2026-09-29" }],
      ["repeated params", { from: ["2026-09-01", "2026-09-02"], to: "2026-09-05" }],
      ["range=custom without dates", { range: "custom" }],
    ])("falls back to the default for %s", (_name, params) => {
      expect(parse(params)).toBe("this-week");
    });

    it("judges 'today' on New York's date, not UTC's", () => {
      // 11:30 PM on Sep 29 in New York is already Sep 30 in UTC.
      const lateNow = new Date("2026-09-30T03:30:00Z");
      expect(parseOverviewSelection({ from: "2026-09-29", to: "2026-09-29" }, lateNow)).toEqual({ from: "2026-09-29", to: "2026-09-29" });
      expect(parseOverviewSelection({ from: "2026-09-29", to: "2026-09-30" }, lateNow)).toBe("this-week");
    });
  });

  describe("links that keep the range", () => {
    it("leaves the default's URL clean and names any other range", () => {
      expect(overviewHref("this-week")).toBe("/admin");
      expect(overviewHref("last-90-days")).toBe("/admin?range=last-90-days");
      expect(overviewHref({ from: "2026-09-01", to: "2026-09-14" })).toBe("/admin?from=2026-09-01&to=2026-09-14");
    });

    it("adds other params after the range", () => {
      expect(overviewHref("this-week", { order: "abc" })).toBe("/admin?order=abc");
      expect(overviewHref("last-month", { order: "abc" })).toBe("/admin?range=last-month&order=abc");
      expect(rangeSearchParams({ from: "2026-09-01", to: "2026-09-14" }).toString()).toBe("from=2026-09-01&to=2026-09-14");
    });

    it("round-trips through the parser", () => {
      const custom = { from: "2026-08-10", to: "2026-09-02" };
      expect(parseOverviewSelection(Object.fromEntries(rangeSearchParams(custom)), NOW)).toEqual(custom);
    });
  });

  it("lists a selection's days from the shop's today alone (for the picker)", () => {
    expect(rangeDays("last-week", "2026-09-29")).toEqual(overviewRange("last-week", NOW).days);
    expect(rangeDays({ from: "2026-09-01", to: "2026-09-03" }, "2026-09-29")).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
  });
});
