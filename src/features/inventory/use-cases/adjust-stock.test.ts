import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { InMemoryInventoryRepository } from "../repositories/in-memory-inventory-repository";
import { adjustStock } from "./adjust-stock";
import { getLowStockCount, getLowStockItems } from "./get-low-stock";

const admin = { accountId: "admin-1", role: "ADMIN" as const };
const customer = { accountId: "c-1", role: "CUSTOMER" as const };

function setup() {
  const inventory = new InMemoryInventoryRepository([
    { id: "a", name: "Cleaner", sku: null, category: "Cleaning", stock: 2, lowStockAt: 5, active: true },
    { id: "b", name: "Laces", sku: "L-1", category: "Laces", stock: 5, lowStockAt: 5, active: true },
    { id: "c", name: "Brush", sku: null, category: "Supplies", stock: 50, lowStockAt: 5, active: true },
    { id: "d", name: "Old dye", sku: null, category: "Restoration", stock: 0, lowStockAt: 5, active: false },
  ]);
  return { inventory, deps: { inventory } };
}
const req = { itemId: "a", change: 10, reason: "RESTOCK", note: " delivery ", seenStock: 2 };

describe("low stock", () => {
  it("counts and lists only active items at or below their level, lowest first", async () => {
    const { deps } = setup();
    expect(await getLowStockCount(deps, admin)).toBe(2);
    expect((await getLowStockItems(deps, admin)).map((i) => i.id)).toEqual(["a", "b"]);
  });
  it("is admin-only", async () => {
    const { deps } = setup();
    await expect(getLowStockCount(deps, customer)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(getLowStockItems(deps, customer)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("adjustStock", () => {
  it("updates stock and records the movement with the actor", async () => {
    const { deps, inventory } = setup();
    expect(await adjustStock(deps, admin, req)).toEqual({ ok: true, stock: 12 });
    expect(inventory.movements).toEqual([{ itemId: "a", change: 10, reason: "RESTOCK", note: "delivery", actorAccountId: "admin-1" }]);
  });
  it("refuses a replay with the stale stock", async () => {
    const { deps, inventory } = setup();
    await adjustStock(deps, admin, req);
    const again = await adjustStock(deps, admin, req);
    expect(again).toMatchObject({ ok: false });
    expect(inventory.movements).toHaveLength(1);
    expect(inventory.items[0]?.stock).toBe(12);
  });
  it("refuses going below 0", async () => {
    const { deps, inventory } = setup();
    const result = await adjustStock(deps, admin, { ...req, change: -3, reason: "ADJUSTMENT" });
    expect(result).toMatchObject({ ok: false });
    expect(inventory.movements).toHaveLength(0);
  });
  it.each([
    ["zero", { change: 0 }],
    ["fractional", { change: 1.5 }],
    ["too large", { change: 10_001 }],
    ["bad reason", { reason: "USED" }],
    ["long note", { note: "x".repeat(501) }],
  ])("rejects %s input", async (_name, patch) => {
    const { deps, inventory } = setup();
    expect(await adjustStock(deps, admin, { ...req, ...patch })).toMatchObject({ ok: false });
    expect(inventory.movements).toHaveLength(0);
  });
  it("reports a missing item", async () => {
    const { deps } = setup();
    expect(await adjustStock(deps, admin, { ...req, itemId: "zzz" })).toMatchObject({ ok: false, error: "This item no longer exists." });
  });
  it("is admin-only", async () => {
    const { deps } = setup();
    await expect(adjustStock(deps, customer, req)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
