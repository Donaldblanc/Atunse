import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { InMemoryInventoryRepository } from "../repositories/in-memory-inventory-repository";
import { InventoryChangedError, InventoryItemNotFoundError, InventorySkuTakenError } from "../repositories/inventory-repository";
import { createInventoryItem, InventoryValidationError, setInventoryItemActive, updateInventoryItem, type InventoryItemRequest } from "./save-inventory-item";

const admin = { accountId: "admin-1", role: "ADMIN" as const };
const customer = { accountId: "c-1", role: "CUSTOMER" as const };

const request = (over: Partial<InventoryItemRequest & { initialStock: number }> = {}) => ({
  name: " Sneaker Cleaner ",
  description: "",
  sku: " ATU-1 ",
  brand: "Jason Markk",
  category: "Cleaning",
  lowStockAt: 5,
  unitCostCents: 899,
  sellingPriceCents: null,
  supplierId: null,
  active: true,
  initialStock: 10,
  ...over,
});

function setup() {
  const inventory = new InMemoryInventoryRepository();
  return { inventory, deps: { inventory } };
}

describe("createInventoryItem", () => {
  it("trims, nulls blanks, and records the initial stock as a RESTOCK movement by the actor", async () => {
    const { deps, inventory } = setup();
    const created = await createInventoryItem(deps, admin, request());
    expect(created).toMatchObject({ name: "Sneaker Cleaner", sku: "ATU-1", description: null, stock: 10, unitCostCents: 899, sellingPriceCents: null });
    expect(inventory.movements).toEqual([{ itemId: created.id, change: 10, reason: "RESTOCK", note: "Initial stock", actorAccountId: "admin-1" }]);
  });

  it("writes no movement for zero initial stock", async () => {
    const { deps, inventory } = setup();
    await createInventoryItem(deps, admin, request({ initialStock: 0 }));
    expect(inventory.movements).toEqual([]);
  });

  it("is admin-only", async () => {
    const { deps } = setup();
    await expect(createInventoryItem(deps, customer, request())).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it.each([
    ["a blank name", { name: "  " }],
    ["a long name", { name: "x".repeat(101) }],
    ["a long description", { description: "x".repeat(501) }],
    ["a long sku", { sku: "x".repeat(41) }],
    ["an unknown category", { category: "Shoes" }],
    ["a negative low stock level", { lowStockAt: -1 }],
    ["a fractional low stock level", { lowStockAt: 1.5 }],
    ["a huge initial stock", { initialStock: 10_001 }],
    ["a negative cost", { unitCostCents: -1 }],
    ["a fractional price", { sellingPriceCents: 1.5 }],
    ["an unknown supplier", { supplierId: "nope" }],
  ])("refuses %s", async (_label, over) => {
    const { deps, inventory } = setup();
    await expect(createInventoryItem(deps, admin, request(over))).rejects.toBeInstanceOf(InventoryValidationError);
    expect(inventory.items).toHaveLength(0);
  });

  it("refuses a duplicate sku", async () => {
    const { deps } = setup();
    await createInventoryItem(deps, admin, request());
    await expect(createInventoryItem(deps, admin, request({ name: "Other" }))).rejects.toBeInstanceOf(InventorySkuTakenError);
  });

  it("accepts an existing supplier", async () => {
    const { deps, inventory } = setup();
    const supplier = await inventory.createSupplier({ name: "Acme", email: null, phone: null, website: null, notes: null });
    expect(await createInventoryItem(deps, admin, request({ supplierId: supplier.id }))).toMatchObject({ supplierId: supplier.id });
  });
});

describe("updateInventoryItem", () => {
  it("saves the fields and leaves stock alone", async () => {
    const { deps } = setup();
    const created = await createInventoryItem(deps, admin, request());
    const updated = await updateInventoryItem(deps, admin, { ...request({ name: "Renamed", lowStockAt: 2 }), itemId: created.id, expectedUpdatedAt: created.updatedAt });
    expect(updated).toMatchObject({ name: "Renamed", lowStockAt: 2, stock: 10 });
  });

  it("refuses a stale updatedAt", async () => {
    const { deps } = setup();
    const created = await createInventoryItem(deps, admin, request());
    await updateInventoryItem(deps, admin, { ...request(), itemId: created.id, expectedUpdatedAt: created.updatedAt });
    await expect(updateInventoryItem(deps, admin, { ...request(), itemId: created.id, expectedUpdatedAt: created.updatedAt })).rejects.toBeInstanceOf(InventoryChangedError);
  });

  it("refuses another item's sku, a missing item, and a non-admin", async () => {
    const { deps } = setup();
    await createInventoryItem(deps, admin, request());
    const other = await createInventoryItem(deps, admin, request({ name: "Other", sku: "ATU-2" }));
    await expect(updateInventoryItem(deps, admin, { ...request(), itemId: other.id, expectedUpdatedAt: other.updatedAt })).rejects.toBeInstanceOf(InventorySkuTakenError);
    await expect(updateInventoryItem(deps, admin, { ...request(), itemId: "nope", expectedUpdatedAt: new Date() })).rejects.toBeInstanceOf(InventoryItemNotFoundError);
    await expect(updateInventoryItem(deps, customer, { ...request(), itemId: other.id, expectedUpdatedAt: other.updatedAt })).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("setInventoryItemActive", () => {
  it("deactivates and reactivates; never deletes", async () => {
    const { deps, inventory } = setup();
    const created = await createInventoryItem(deps, admin, request());
    expect(await setInventoryItemActive(deps, admin, created.id, false)).toMatchObject({ active: false });
    expect(inventory.items).toHaveLength(1);
    expect(await setInventoryItemActive(deps, admin, created.id, true)).toMatchObject({ active: true });
  });

  it("refuses a missing item and a non-admin", async () => {
    const { deps } = setup();
    await expect(setInventoryItemActive(deps, admin, "nope", false)).rejects.toBeInstanceOf(InventoryItemNotFoundError);
    await expect(setInventoryItemActive(deps, customer, "nope", false)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
