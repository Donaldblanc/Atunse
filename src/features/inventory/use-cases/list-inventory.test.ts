import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { InMemoryInventoryRepository } from "../repositories/in-memory-inventory-repository";
import { getInventoryItem } from "./get-inventory-item";
import { INVENTORY_PAGE_SIZE, listInventory, parseInventoryQuery } from "./list-inventory";
import { adjustStock } from "./adjust-stock";

const admin = { accountId: "admin-1", role: "ADMIN" as const };
const customer = { accountId: "c-1", role: "CUSTOMER" as const };

function setup() {
  const inventory = new InMemoryInventoryRepository([
    { id: "a", name: "Cleaner", sku: "ATU-1", brand: "Jason Markk", category: "Cleaning", stock: 2, lowStockAt: 5, active: true },
    { id: "b", name: "Laces", sku: null, category: "Laces", stock: 0, lowStockAt: 5, active: true },
    { id: "c", name: "Brush", sku: null, category: "Supplies", stock: 50, lowStockAt: 5, active: true },
    { id: "d", name: "Old dye", sku: null, category: "Restoration", stock: 0, lowStockAt: 5, active: false },
  ]);
  return { inventory, deps: { inventory } };
}
const query = (over = {}) => ({ ...parseInventoryQuery({}), ...over });

describe("parseInventoryQuery", () => {
  it("defaults and clamps", () => {
    expect(parseInventoryQuery({})).toEqual({ q: "", category: "", status: "", supplierId: "", page: 1 });
    expect(parseInventoryQuery({ q: "x".repeat(200), page: "0", status: "bogus" })).toMatchObject({ q: "x".repeat(100), page: 1, status: "" });
    expect(parseInventoryQuery({ page: "3", status: ["LOW_STOCK", "x"] })).toMatchObject({ page: 3, status: "LOW_STOCK" });
    expect(parseInventoryQuery({ status: "INACTIVE" }).status).toBe("INACTIVE");
  });
});

describe("listInventory", () => {
  it("lists everything by name with active-only stats", async () => {
    const { deps } = setup();
    const list = await listInventory(deps, admin, query());
    expect(list.rows.map((r) => r.name)).toEqual(["Brush", "Cleaner", "Laces", "Old dye"]);
    expect(list.stats).toEqual({ total: 3, inStock: 1, lowStock: 1, outOfStock: 1 });
    expect(list.pageCount).toBe(1);
  });

  it("filters by status, search, and category", async () => {
    const { deps } = setup();
    expect((await listInventory(deps, admin, query({ status: "LOW_STOCK" }))).rows.map((r) => r.id)).toEqual(["a"]);
    expect((await listInventory(deps, admin, query({ status: "OUT_OF_STOCK" }))).rows.map((r) => r.id)).toEqual(["b"]);
    expect((await listInventory(deps, admin, query({ status: "INACTIVE" }))).rows.map((r) => r.id)).toEqual(["d"]);
    expect((await listInventory(deps, admin, query({ q: "markk" }))).rows.map((r) => r.id)).toEqual(["a"]);
    expect((await listInventory(deps, admin, query({ category: "Supplies" }))).rows.map((r) => r.id)).toEqual(["c"]);
  });

  it("pages", async () => {
    const inventory = new InMemoryInventoryRepository(
      Array.from({ length: INVENTORY_PAGE_SIZE + 1 }, (_, i) => ({ id: `i${i}`, name: `Item ${String(i).padStart(2, "0")}`, sku: null, category: "Supplies", stock: 9, lowStockAt: 1, active: true })),
    );
    const second = await listInventory({ inventory }, admin, query({ page: 2 }));
    expect(second).toMatchObject({ total: INVENTORY_PAGE_SIZE + 1, page: 2, pageCount: 2 });
    expect(second.rows).toHaveLength(1);
  });

  it("is admin-only", async () => {
    const { deps } = setup();
    await expect(listInventory(deps, customer, query())).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("getInventoryItem", () => {
  it("returns the item, its history newest first, and its supplier", async () => {
    const { deps, inventory } = setup();
    const supplier = await inventory.createSupplier({ name: "Acme", email: null, phone: null, website: null, notes: null });
    inventory.items[0]!.supplierId = supplier.id;
    await adjustStock(deps, admin, { itemId: "a", change: 3, reason: "RESTOCK", note: "first", seenStock: 2 });
    await adjustStock(deps, admin, { itemId: "a", change: -1, reason: "ADJUSTMENT", note: "second", seenStock: 5 });
    const detail = await getInventoryItem(deps, admin, "a");
    expect(detail?.item.name).toBe("Cleaner");
    expect(detail?.supplier?.name).toBe("Acme");
    expect(detail?.movements.map((m) => m.note)).toEqual(["second", "first"]);
  });

  it("returns null for a missing item and is admin-only", async () => {
    const { deps } = setup();
    expect(await getInventoryItem(deps, admin, "nope")).toBeNull();
    await expect(getInventoryItem(deps, customer, "a")).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
