import { describe, expect, it } from "vitest";
import { Money } from "./money";

describe("Money", () => {
  it("rejects non-integer cents", () => {
    expect(() => Money.fromCents(10.5)).toThrow();
  });

  it("computes a 50% deposit rounded down", () => {
    const price = Money.fromCents(4501); // $45.01
    expect(price.percentage(0.5).cents).toBe(2250); // not 2250.5
  });

  it("refuses to mix currencies", () => {
    const usd = Money.fromCents(100, "USD");
    // @ts-expect-error - deliberately wrong currency for the test
    const other = Money.fromCents(100, "EUR");
    expect(() => usd.add(other)).toThrow();
  });

  it("adds and subtracts correctly", () => {
    const a = Money.fromCents(1000);
    const b = Money.fromCents(300);
    expect(a.subtract(b).cents).toBe(700);
    expect(a.add(b).cents).toBe(1300);
  });

  it("formats whole dollars without cents and partial dollars with two decimals", () => {
    expect(Money.fromCents(3000).format()).toBe("$30");
    expect(Money.fromCents(1262).format()).toBe("$12.62");
    expect(Money.fromCents(5).format()).toBe("$0.05");
    expect(Money.fromCents(-250).format()).toBe("-$2.50");
  });
});
