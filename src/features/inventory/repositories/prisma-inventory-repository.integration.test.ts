// Proves the InventoryRepository against a REAL Postgres. Run with `npm run test:integration`.

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  InventoryChangedError,
  InventoryImageKeyTakenError,
  InventoryImageNotFoundError,
  InventoryItemNotFoundError,
  InventorySkuTakenError,
  NegativeStockError,
  StockChangedError,
  TooManyInventoryImagesError,
  type InventoryItemInput,
  type InventoryQuery,
} from "./inventory-repository";
import { PrismaInventoryRepository } from "./prisma-inventory-repository";

const prisma = new PrismaClient();
const repo = new PrismaInventoryRepository(prisma);

beforeEach(async () => {
  // Only inventory rows: movements first, then items.
  await prisma.stockMovement.deleteMany();
  await prisma.inventoryImage.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.supplier.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const item = (name: string, stock: number, lowStockAt: number, active = true) =>
  prisma.inventoryItem.create({ data: { name, category: "Cleaning", stock, lowStockAt, active } });

describe("PrismaInventoryRepository low stock (integration)", () => {
  it("counts and lists active items at or below their level", async () => {
    await item("Cleaner", 2, 5);
    await item("Laces", 5, 5);
    await item("Brush", 50, 5);
    await item("Retired", 0, 5, false);
    expect(await repo.countLowStock()).toBe(2);
    expect((await repo.listLowStock()).map((i) => i.name)).toEqual(["Cleaner", "Laces"]);
  });
});

describe("PrismaInventoryRepository adjustStock (integration)", () => {
  it("updates stock and writes the movement together", async () => {
    const { id } = await item("Cleaner", 2, 5);
    expect(await repo.adjustStock({ itemId: id, change: 10, reason: "RESTOCK", note: "delivery", seenStock: 2, actorAccountId: null })).toEqual({ stock: 12 });
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).stock).toBe(12);
    const movements = await prisma.stockMovement.findMany({ where: { itemId: id } });
    expect(movements).toMatchObject([{ change: 10, reason: "RESTOCK", note: "delivery" }]);
  });

  it("refuses a stale seenStock and writes nothing", async () => {
    const { id } = await item("Cleaner", 2, 5);
    await expect(repo.adjustStock({ itemId: id, change: 1, reason: "ADJUSTMENT", note: null, seenStock: 9, actorAccountId: null })).rejects.toBeInstanceOf(StockChangedError);
    expect(await prisma.stockMovement.count({ where: { itemId: id } })).toBe(0);
  });

  it("refuses a result below 0 and writes nothing", async () => {
    const { id } = await item("Cleaner", 2, 5);
    await expect(repo.adjustStock({ itemId: id, change: -3, reason: "ADJUSTMENT", note: null, seenStock: 2, actorAccountId: null })).rejects.toBeInstanceOf(NegativeStockError);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).stock).toBe(2);
    expect(await prisma.stockMovement.count({ where: { itemId: id } })).toBe(0);
  });

  it("refuses an unknown item", async () => {
    await expect(repo.adjustStock({ itemId: "nope", change: 1, reason: "RESTOCK", note: null, seenStock: 0, actorAccountId: null })).rejects.toBeInstanceOf(InventoryItemNotFoundError);
  });

  it("applies only one of two concurrent adjustments from the same stock", async () => {
    const { id } = await item("Cleaner", 2, 5);
    const attempt = () => repo.adjustStock({ itemId: id, change: 1, reason: "RESTOCK", note: null, seenStock: 2, actorAccountId: null });
    const results = await Promise.allSettled([attempt(), attempt()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).stock).toBe(3);
    expect(await prisma.stockMovement.count({ where: { itemId: id } })).toBe(1);
  });
});

const query = (over: Partial<InventoryQuery> = {}): InventoryQuery => ({ q: "", category: "", status: "", supplierId: "", page: 1, ...over });
const input = (over: Partial<InventoryItemInput> = {}): InventoryItemInput => ({
  name: "Sneaker Cleaner",
  description: null,
  sku: null,
  brand: null,
  category: "Cleaning",
  lowStockAt: 5,
  unitCostCents: null,
  sellingPriceCents: null,
  supplierId: null,
  active: true,
  ...over,
});

describe("PrismaInventoryRepository listItems (integration)", () => {
  it("filters by derived status and counts active stats only", async () => {
    await item("Cleaner", 2, 5);
    await item("Laces", 0, 5);
    await item("Brush", 50, 5);
    await item("Retired", 0, 5, false);
    const all = await repo.listItems(query(), 20);
    expect(all.total).toBe(4);
    expect(all.stats).toEqual({ total: 3, inStock: 1, lowStock: 1, outOfStock: 1 });
    expect((await repo.listItems(query({ status: "LOW_STOCK" }), 20)).rows.map((r) => r.name)).toEqual(["Cleaner"]);
    expect((await repo.listItems(query({ status: "OUT_OF_STOCK" }), 20)).rows.map((r) => r.name)).toEqual(["Laces"]);
    expect((await repo.listItems(query({ status: "IN_STOCK" }), 20)).rows.map((r) => r.name)).toEqual(["Brush"]);
    expect((await repo.listItems(query({ status: "INACTIVE" }), 20)).rows.map((r) => r.name)).toEqual(["Retired"]);
  });

  it("searches name, sku and brand, filters by category and supplier, and pages by name", async () => {
    const supplier = await repo.createSupplier({ name: "Acme", email: null, phone: null, website: null, notes: null });
    await repo.createItem(input({ name: "Alpha", sku: "ATU-1", brand: "Jason Markk", supplierId: supplier.id }), 0, null);
    await repo.createItem(input({ name: "Beta", category: "Laces" }), 0, null);
    await repo.createItem(input({ name: "Gamma" }), 0, null);
    expect((await repo.listItems(query({ q: "atu-1" }), 20)).rows.map((r) => r.name)).toEqual(["Alpha"]);
    expect((await repo.listItems(query({ q: "markk" }), 20)).rows.map((r) => r.name)).toEqual(["Alpha"]);
    expect((await repo.listItems(query({ category: "Laces" }), 20)).rows.map((r) => r.name)).toEqual(["Beta"]);
    expect((await repo.listItems(query({ supplierId: supplier.id }), 20)).rows.map((r) => r.name)).toEqual(["Alpha"]);
    const second = await repo.listItems(query({ page: 2 }), 2);
    expect(second).toMatchObject({ total: 3, page: 2, pageCount: 2 });
    expect(second.rows.map((r) => r.name)).toEqual(["Gamma"]);
  });
});

describe("PrismaInventoryRepository writes (integration)", () => {
  it("createItem writes the item and an Initial stock movement together", async () => {
    const created = await repo.createItem(input({ sku: "ATU-1" }), 7, null);
    expect(created.stock).toBe(7);
    expect(await repo.listMovements(created.id)).toMatchObject([{ change: 7, reason: "RESTOCK", note: "Initial stock" }]);
    const empty = await repo.createItem(input({ name: "Zero" }), 0, null);
    expect(await repo.listMovements(empty.id)).toEqual([]);
  });

  it("createItem refuses a duplicate sku", async () => {
    await repo.createItem(input({ sku: "ATU-1" }), 0, null);
    await expect(repo.createItem(input({ name: "Other", sku: "ATU-1" }), 0, null)).rejects.toBeInstanceOf(InventorySkuTakenError);
  });

  it("updateItem refuses a stale updatedAt, never touches stock, and reports a missing item", async () => {
    const created = await repo.createItem(input(), 3, null);
    const updated = await repo.updateItem(created.id, { name: "Renamed" }, created.updatedAt);
    expect(updated).toMatchObject({ name: "Renamed", stock: 3 });
    await expect(repo.updateItem(created.id, { name: "Again" }, created.updatedAt)).rejects.toBeInstanceOf(InventoryChangedError);
    expect(await repo.updateItem("nope", { name: "x" }, new Date())).toBeNull();
  });

  it("updateItem refuses a duplicate sku", async () => {
    await repo.createItem(input({ sku: "ATU-1" }), 0, null);
    const other = await repo.createItem(input({ name: "Other", sku: "ATU-2" }), 0, null);
    await expect(repo.updateItem(other.id, { sku: "ATU-1" }, other.updatedAt)).rejects.toBeInstanceOf(InventorySkuTakenError);
  });

  it("setItemActive deactivates and reactivates without deleting", async () => {
    const created = await repo.createItem(input(), 1, null);
    expect(await repo.setItemActive(created.id, false)).toMatchObject({ active: false });
    expect(await repo.setItemActive(created.id, true)).toMatchObject({ active: true });
    expect(await repo.setItemActive("nope", false)).toBeNull();
  });

  it("lists suppliers by name", async () => {
    await repo.createSupplier({ name: "Zed", email: null, phone: null, website: null, notes: null });
    await repo.createSupplier({ name: "Acme", email: "a@b.co", phone: null, website: null, notes: null });
    expect((await repo.listSuppliers()).map((s) => s.name)).toEqual(["Acme", "Zed"]);
  });

  it("attaches and removes images, capped at 5, keys unique", async () => {
    const created = await repo.createItem(input(), 0, null);
    for (let i = 0; i < 5; i++) await repo.addItemImage(created.id, `inventory/${created.id}/${i}.jpg`);
    await expect(repo.addItemImage(created.id, `inventory/${created.id}/6.jpg`)).rejects.toBeInstanceOf(TooManyInventoryImagesError);
    const full = await repo.getItem(created.id);
    expect(full?.images.map((image) => image.position)).toEqual([0, 1, 2, 3, 4]);
    const afterRemove = await repo.removeItemImage(created.id, full!.images[0]!.id);
    expect(afterRemove?.images).toHaveLength(4);
    await expect(repo.removeItemImage(created.id, full!.images[0]!.id)).rejects.toBeInstanceOf(InventoryImageNotFoundError);
    await expect(repo.addItemImage(created.id, `inventory/${created.id}/1.jpg`)).rejects.toBeInstanceOf(InventoryImageKeyTakenError);
    expect(await repo.addItemImage("nope", "inventory/nope/a.jpg")).toBeNull();
  });
});
