import { describe, expect, it } from "vitest";
import { centsToPriceField, parseQuotePrice } from "./quote-price";

describe("parseQuotePrice", () => {
  it.each([
    ["125", 12500],
    ["125.5", 12550],
    ["125.50", 12550],
    ["$1,250.05", 125005],
    ["  90 ", 9000],
    ["5000", 500000],
  ])("reads %s as %s cents", (input, cents) => {
    expect(parseQuotePrice(input)).toEqual({ ok: true, cents });
  });

  it.each(["", "abc", "12.345", "-5", "1e3", "0", "0.00", "0.01", "0.99", "5000.01", "12,5", "$", "1.", ".5"])("refuses %j", (input) => {
    expect(parseQuotePrice(input).ok).toBe(false);
  });
});

describe("centsToPriceField", () => {
  it("drops the cents from whole dollars", () => {
    expect(centsToPriceField(12500)).toBe("125");
    expect(centsToPriceField(12550)).toBe("125.50");
  });
});
