import { describe, expect, it } from "vitest";
import { countTicks, dayAxis, dollarTicks, donutSegments, sharesOf100 } from "./chart-scale";

describe("dollarTicks", () => {
  it("steps in round amounts that cover the tallest bar", () => {
    expect(dollarTicks(700)).toEqual([0, 250, 500, 750]);
    expect(dollarTicks(80)).toEqual([0, 50, 100, 150]);
    expect(dollarTicks(1850)).toEqual([0, 1000, 2000, 3000]);
    expect(dollarTicks(420)).toEqual([0, 200, 400, 600]);
  });

  it("gives an empty range a readable axis", () => {
    expect(dollarTicks(0)).toEqual([0, 50, 100, 150]);
  });
});

describe("donutSegments", () => {
  it("lays shares end to end around the ring", () => {
    expect(donutSegments([1, 1, 2])).toEqual([
      { offset: 0, length: 0.25 },
      { offset: 0.25, length: 0.25 },
      { offset: 0.5, length: 0.5 },
    ]);
  });

  it("draws nothing for all zeros", () => {
    expect(donutSegments([0, 0])).toEqual([
      { offset: 0, length: 0 },
      { offset: 0, length: 0 },
    ]);
  });
});

describe("sharesOf100", () => {
  it("rounds so the legend's percentages add up to 100", () => {
    expect(sharesOf100([1, 1, 1])).toEqual([34, 33, 33]);
    expect(sharesOf100([10, 6, 4, 3, 1])).toEqual([42, 25, 17, 12, 4]);
    expect(sharesOf100([0, 0])).toEqual([0, 0]);
  });
});

describe("countTicks", () => {
  it("steps in whole, round numbers that cover the peak", () => {
    expect(countTicks(0)).toEqual([0, 1, 2, 3]);
    expect(countTicks(3)).toEqual([0, 1, 2, 3]);
    expect(countTicks(4)).toEqual([0, 2, 4, 6]);
    expect(countTicks(9)).toEqual([0, 5, 10, 15]);
    expect(countTicks(11)).toEqual([0, 5, 10, 15]);
  });
});

describe("dayAxis", () => {
  it("labels every day of a week and every fifth day up to a month", () => {
    expect(dayAxis(7)).toEqual({ everyDay: true, labelStep: 1, veryDense: false });
    expect(dayAxis(31)).toEqual({ everyDay: false, labelStep: 5, veryDense: false });
  });

  it("keeps a long range to about six labels and drops the per-day tab stops", () => {
    expect(dayAxis(90)).toEqual({ everyDay: false, labelStep: 15, veryDense: true });
    expect(dayAxis(366)).toEqual({ everyDay: false, labelStep: 61, veryDense: true });
  });
});
