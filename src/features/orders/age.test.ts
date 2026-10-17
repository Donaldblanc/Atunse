import { describe, expect, it } from "vitest";
import { birthYearOptions, isAdultByBirthMonth, isBirthMonthYear } from "./age";

const at = (iso: string) => new Date(`${iso}T16:00:00Z`);

describe("isAdultByBirthMonth", () => {
  it("is false in the month of the 18th birthday and true the month after", () => {
    expect(isAdultByBirthMonth(3, 2008, at("2026-03-15"))).toBe(false);
    expect(isAdultByBirthMonth(3, 2008, at("2026-04-01"))).toBe(true);
  });

  it("is false the month before the 18th birthday month", () => {
    expect(isAdultByBirthMonth(4, 2008, at("2026-03-31"))).toBe(false);
    expect(isAdultByBirthMonth(2, 2008, at("2026-03-31"))).toBe(true);
  });

  it("is false for anyone born later than 18 years ago and true for older birth years", () => {
    expect(isAdultByBirthMonth(1, 2009, at("2026-12-31"))).toBe(false);
    expect(isAdultByBirthMonth(1, 1990, at("2026-01-10"))).toBe(true);
  });

  it("wraps across January and December", () => {
    expect(isAdultByBirthMonth(12, 2007, at("2026-01-10"))).toBe(true);
    expect(isAdultByBirthMonth(1, 2008, at("2026-01-10"))).toBe(false);
    expect(isAdultByBirthMonth(1, 2008, at("2026-02-01"))).toBe(true);
    expect(isAdultByBirthMonth(12, 2008, at("2026-12-31"))).toBe(false);
    expect(isAdultByBirthMonth(11, 2008, at("2026-12-31"))).toBe(true);
  });

  it("treats leap years like any other (month precision only)", () => {
    expect(isAdultByBirthMonth(2, 2008, at("2026-02-28"))).toBe(false);
    expect(isAdultByBirthMonth(2, 2008, at("2026-03-01"))).toBe(true);
    expect(isAdultByBirthMonth(2, 2004, at("2022-02-28"))).toBe(false);
    expect(isAdultByBirthMonth(2, 2004, at("2022-03-01"))).toBe(true);
  });

  it("uses New York time for the current month", () => {
    // 2026-04-01 02:00 UTC is still 31 March in New York.
    expect(isAdultByBirthMonth(3, 2008, new Date("2026-04-01T02:00:00Z"))).toBe(false);
    expect(isAdultByBirthMonth(3, 2008, new Date("2026-04-01T05:00:00Z"))).toBe(true);
  });
});

describe("isBirthMonthYear", () => {
  const now = at("2026-10-17");

  it("accepts real months and years", () => {
    expect(isBirthMonthYear(1, 1990, now)).toBe(true);
    expect(isBirthMonthYear(12, 2026, now)).toBe(true);
  });

  it("rejects bad months, future and ancient years, and non-integers", () => {
    expect(isBirthMonthYear(0, 1990, now)).toBe(false);
    expect(isBirthMonthYear(13, 1990, now)).toBe(false);
    expect(isBirthMonthYear(3, 2027, now)).toBe(false);
    expect(isBirthMonthYear(3, 1900, now)).toBe(false);
    expect(isBirthMonthYear(3.5, 1990, now)).toBe(false);
    expect(isBirthMonthYear("3", 1990, now)).toBe(false);
    expect(isBirthMonthYear(undefined, undefined, now)).toBe(false);
  });
});

describe("birthYearOptions", () => {
  it("lists this year back 100, newest first", () => {
    const years = birthYearOptions(at("2026-10-17"));
    expect(years).toHaveLength(101);
    expect(years[0]).toBe(2026);
    expect(years.at(-1)).toBe(1926);
  });
});
