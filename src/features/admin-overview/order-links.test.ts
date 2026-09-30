import { describe, expect, it } from "vitest";
import { orderIdFromSearchParams, overviewHref } from "./order-links";

describe("overviewHref", () => {
  it("adds the order and keeps the range params", () => {
    expect(overviewHref({ range: "custom", from: "2026-09-01", to: "2026-09-30" }, "ord_1")).toBe(
      "/admin?range=custom&from=2026-09-01&to=2026-09-30&order=ord_1",
    );
  });

  it("replaces an order already open", () => {
    expect(overviewHref({ order: "old", range: "7d" }, "new")).toBe("/admin?range=7d&order=new");
  });

  it("removes the order to close, leaving a bare URL when nothing else is set", () => {
    expect(overviewHref({ order: "ord_1", range: "7d" }, null)).toBe("/admin?range=7d");
    expect(overviewHref({ order: "ord_1" }, null)).toBe("/admin");
  });

  it("keeps repeated params and skips absent ones", () => {
    expect(overviewHref({ a: ["1", "2"], b: undefined }, null)).toBe("/admin?a=1&a=2");
  });
});

describe("orderIdFromSearchParams", () => {
  it("reads the first order param, and null for none or an empty one", () => {
    expect(orderIdFromSearchParams({ order: "ord_1" })).toBe("ord_1");
    expect(orderIdFromSearchParams({ order: ["a", "b"] })).toBe("a");
    expect(orderIdFromSearchParams({ order: "" })).toBeNull();
    expect(orderIdFromSearchParams({})).toBeNull();
  });
});
