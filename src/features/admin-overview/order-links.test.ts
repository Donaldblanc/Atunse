import { describe, expect, it } from "vitest";
import { orderIdFromSearchParams } from "./order-links";

describe("orderIdFromSearchParams", () => {
  it("reads the first order param, and null for none or an empty one", () => {
    expect(orderIdFromSearchParams({ order: "ord_1" })).toBe("ord_1");
    expect(orderIdFromSearchParams({ order: ["a", "b"] })).toBe("a");
    expect(orderIdFromSearchParams({ order: "" })).toBeNull();
    expect(orderIdFromSearchParams({})).toBeNull();
  });
});
