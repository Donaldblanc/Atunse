import { describe, expect, it } from "vitest";
import { inventoryHref, pageNumbers, parseInventoryTab } from "./inventory-href";
import type { InventoryQuery } from "./repositories/inventory-repository";

const empty: InventoryQuery = { q: "", category: "", status: "", supplierId: "", page: 1 };

describe("inventoryHref", () => {
  it("is the bare route with no query", () => {
    expect(inventoryHref(empty)).toBe("/admin/inventory");
  });

  it("keeps the search, filters and page", () => {
    const query: InventoryQuery = { q: "lace", category: "Laces", status: "LOW_STOCK", supplierId: "sup_1", page: 3 };
    expect(inventoryHref(query)).toBe("/admin/inventory?q=lace&category=Laces&status=LOW_STOCK&supplierId=sup_1&page=3");
  });

  it("lets an override replace the page, and leaves page 1 out", () => {
    expect(inventoryHref({ ...empty, page: 4 }, { page: 2 })).toBe("/admin/inventory?page=2");
    expect(inventoryHref({ ...empty, page: 4 }, { page: 1 })).toBe("/admin/inventory");
  });

  it("adds the open item and its tab (details is the default and left out)", () => {
    expect(inventoryHref({ ...empty, q: "a" }, { item: "i1" })).toBe("/admin/inventory?q=a&item=i1");
    expect(inventoryHref(empty, { item: "i1", tab: "history" })).toBe("/admin/inventory?item=i1&tab=history");
    expect(inventoryHref(empty, { item: "i1", tab: "details" })).toBe("/admin/inventory?item=i1");
  });

  it("ignores a tab without an item, and opens Add Item with new=1", () => {
    expect(inventoryHref(empty, { tab: "history" })).toBe("/admin/inventory");
    expect(inventoryHref({ ...empty, status: "INACTIVE" }, { isNew: true })).toBe("/admin/inventory?status=INACTIVE&new=1");
  });
});

describe("parseInventoryTab", () => {
  it("falls back to details", () => {
    expect(parseInventoryTab("history")).toBe("history");
    expect(parseInventoryTab("supplier")).toBe("supplier");
    expect(parseInventoryTab("related")).toBe("details");
    expect(parseInventoryTab(undefined)).toBe("details");
  });
});

describe("pageNumbers", () => {
  it("windows around the current page", () => {
    expect(pageNumbers(1, 3)).toEqual([1, 2, 3]);
    expect(pageNumbers(1, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(pageNumbers(5, 10)).toEqual([3, 4, 5, 6, 7]);
    expect(pageNumbers(10, 10)).toEqual([6, 7, 8, 9, 10]);
  });
});
