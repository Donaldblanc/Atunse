import { Prisma, type PrismaClient } from "@prisma/client";
import {
  InventoryItemNotFoundError,
  NegativeStockError,
  StockChangedError,
  type AdjustStockInput,
  type InventoryRepository,
  type LowStockItem,
} from "./inventory-repository";

export class PrismaInventoryRepository implements InventoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async countLowStock(): Promise<number> {
    // Column-to-column comparison: Prisma's filters can't express it.
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`SELECT COUNT(*) AS count FROM inventory_items WHERE active = true AND stock <= "lowStockAt"`,
    );
    return Number(rows[0]?.count ?? 0);
  }

  async listLowStock(): Promise<LowStockItem[]> {
    return this.prisma.$queryRaw<LowStockItem[]>(
      Prisma.sql`SELECT id, name, sku, category, stock, "lowStockAt" FROM inventory_items
        WHERE active = true AND stock <= "lowStockAt" ORDER BY stock ASC, name ASC`,
    );
  }

  async adjustStock(input: AdjustStockInput): Promise<{ stock: number }> {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: input.itemId }, select: { stock: true } });
      if (!item) throw new InventoryItemNotFoundError();
      if (item.stock !== input.seenStock) throw new StockChangedError(item.stock);
      const next = item.stock + input.change;
      if (next < 0) throw new NegativeStockError(item.stock);
      // Optimistic: a concurrent write between the read and here updates nothing.
      const updated = await tx.inventoryItem.updateMany({
        where: { id: input.itemId, stock: input.seenStock },
        data: { stock: next },
      });
      if (updated.count !== 1) {
        const now = await tx.inventoryItem.findUnique({ where: { id: input.itemId }, select: { stock: true } });
        throw new StockChangedError(now?.stock ?? item.stock);
      }
      await tx.stockMovement.create({
        data: { itemId: input.itemId, change: input.change, reason: input.reason, note: input.note, actorAccountId: input.actorAccountId },
      });
      return { stock: next };
    });
  }
}
