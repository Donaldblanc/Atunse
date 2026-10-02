// Proves the InventoryRepository against a REAL Postgres. Run with `npm run test:integration`.

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { InventoryItemNotFoundError, NegativeStockError, StockChangedError } from "./inventory-repository";
import { PrismaInventoryRepository } from "./prisma-inventory-repository";

const prisma = new PrismaClient();
const repo = new PrismaInventoryRepository(prisma);

beforeEach(async () => {
  // Only inventory rows: movements first, then items.
  await prisma.stockMovement.deleteMany();
  await prisma.inventoryImage.deleteMany();
  await prisma.inventoryItem.deleteMany();
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
