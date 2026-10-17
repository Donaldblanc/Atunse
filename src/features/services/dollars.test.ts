import { describe, expect, it } from "vitest";
import { parseDollarsToCents } from "./dollars";

describe("parseDollarsToCents", () => {
  it("parses whole and fractional dollars exactly", () => {
    expect(parseDollarsToCents("85")).toBe(8500);
    expect(parseDollarsToCents(" 85.5 ")).toBe(8550);
    expect(parseDollarsToCents("0.07")).toBe(7);
    expect(parseDollarsToCents("19.99")).toBe(1999);
    expect(parseDollarsToCents("0")).toBe(0);
  });

  it("rejects blank, hex, exponent and other non-decimal forms", () => {
    for (const bad of ["", "   ", "0x10", "1e3", "Infinity", "-5", "+5", "1,000", "$5", "5.", ".5", "5.123", "1234567", "abc"]) {
      expect(parseDollarsToCents(bad)).toBeNaN();
    }
  });
});
