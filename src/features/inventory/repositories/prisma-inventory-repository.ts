import { Prisma, type PrismaClient } from "@prisma/client";
import {
  InventoryChangedError,
  InventoryImageKeyTakenError,
  InventoryImageNotFoundError,
  InventoryItemNotFoundError,
  InventorySkuTakenError,
  MAX_INVENTORY_IMAGES,
  NegativeStockError,
  StockChangedError,
  TooManyInventoryImagesError,
  type AdjustStockInput,
  type InventoryItemInput,
  type InventoryItemRecord,
  type InventoryList,
  type InventoryQuery,
  type InventoryRepository,
  type LowStockItem,
  type NewSupplierInput,
  type StockMovementRecord,
  type SupplierRecord,
} from "./inventory-repository";

const itemInclude = { images: { orderBy: { position: "asc" as const } } };

function isPrismaError(err: unknown, code: string): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}

// Column-to-column comparisons (stock vs "lowStockAt") can't be written as Prisma filters.
const STATUS_SQL = {
  OUT_OF_STOCK: Prisma.sql`stock <= 0`,
  LOW_STOCK: Prisma.sql`stock > 0 AND stock <= "lowStockAt"`,
  IN_STOCK: Prisma.sql`stock > 0 AND stock > "lowStockAt"`,
} as const;

export class PrismaInventoryRepository implements InventoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listItems(query: InventoryQuery, pageSize: number): Promise<InventoryList> {
    const statsRows = await this.prisma.$queryRaw<{ total: bigint; in_stock: bigint; low_stock: bigint; out_of_stock: bigint }[]>(
      Prisma.sql`SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE ${STATUS_SQL.IN_STOCK}) AS in_stock,
          COUNT(*) FILTER (WHERE ${STATUS_SQL.LOW_STOCK}) AS low_stock,
          COUNT(*) FILTER (WHERE ${STATUS_SQL.OUT_OF_STOCK}) AS out_of_stock
        FROM inventory_items WHERE active = true`,
    );
    const s = statsRows[0];
    const stats = {
      total: Number(s?.total ?? 0),
      inStock: Number(s?.in_stock ?? 0),
      lowStock: Number(s?.low_stock ?? 0),
      outOfStock: Number(s?.out_of_stock ?? 0),
    };

    const where: Prisma.InventoryItemWhereInput = {};
    const q = query.q.trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
      ];
    }
    if (query.category) where.category = query.category;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.status === "INACTIVE") {
      where.active = false;
    } else if (query.status) {
      const ids = await this.prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM inventory_items WHERE active = true AND ${STATUS_SQL[query.status]}`,
      );
      where.id = { in: ids.map((row) => row.id) };
    }

    const total = await this.prisma.inventoryItem.count({ where });
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, query.page), pageCount);
    const rows = await this.prisma.inventoryItem.findMany({
      where,
      include: itemInclude,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { rows, total, page, pageCount, stats };
  }

  async getItem(id: string): Promise<InventoryItemRecord | null> {
    return this.prisma.inventoryItem.findUnique({ where: { id }, include: itemInclude });
  }

  async listMovements(itemId: string, limit = 50): Promise<StockMovementRecord[]> {
    return this.prisma.stockMovement.findMany({
      where: { itemId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: { id: true, change: true, reason: true, note: true, orderId: true, actorAccountId: true, createdAt: true },
    });
  }

  async createItem(input: InventoryItemInput, initialStock: number, actorAccountId: string | null): Promise<InventoryItemRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.create({ data: { ...input, stock: initialStock }, include: itemInclude });
        if (initialStock > 0) {
          await tx.stockMovement.create({
            data: { itemId: item.id, change: initialStock, reason: "RESTOCK", note: "Initial stock", actorAccountId },
          });
        }
        return item;
      });
    } catch (err) {
      if (isPrismaError(err, "P2002")) throw new InventorySkuTakenError(input.sku ?? "");
      throw err;
    }
  }

  async updateItem(id: string, patch: Partial<InventoryItemInput>, expectedUpdatedAt: Date): Promise<InventoryItemRecord | null> {
    try {
      // Conditional on updatedAt: a save that landed since the form loaded makes count 0.
      const { count } = await this.prisma.inventoryItem.updateMany({ where: { id, updatedAt: expectedUpdatedAt }, data: patch });
      if (count === 0) {
        if (!(await this.prisma.inventoryItem.findUnique({ where: { id }, select: { id: true } }))) return null;
        throw new InventoryChangedError();
      }
    } catch (err) {
      if (isPrismaError(err, "P2002")) throw new InventorySkuTakenError(patch.sku ?? "");
      throw err;
    }
    return this.getItem(id);
  }

  async setItemActive(id: string, active: boolean): Promise<InventoryItemRecord | null> {
    try {
      return await this.prisma.inventoryItem.update({ where: { id }, data: { active }, include: itemInclude });
    } catch (err) {
      if (isPrismaError(err, "P2025")) return null;
      throw err;
    }
  }

  async listSuppliers(): Promise<SupplierRecord[]> {
    return this.prisma.supplier.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, email: true, phone: true, website: true, notes: true },
    });
  }

  async createSupplier(input: NewSupplierInput): Promise<SupplierRecord> {
    return this.prisma.supplier.create({
      data: input,
      select: { id: true, name: true, email: true, phone: true, website: true, notes: true },
    });
  }

  async addItemImage(itemId: string, key: string): Promise<InventoryItemRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: itemId }, include: itemInclude });
      if (!item) return null;
      if (item.images.length >= MAX_INVENTORY_IMAGES) throw new TooManyInventoryImagesError();
      const nextPosition = item.images.reduce((max, image) => Math.max(max, image.position), -1) + 1;
      try {
        await tx.inventoryImage.create({ data: { itemId, key, position: nextPosition } });
      } catch (err) {
        if (isPrismaError(err, "P2002")) throw new InventoryImageKeyTakenError(key);
        throw err;
      }
      return tx.inventoryItem.findUniqueOrThrow({ where: { id: itemId }, include: itemInclude });
    });
  }

  async removeItemImage(itemId: string, imageId: string): Promise<InventoryItemRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: itemId }, include: itemInclude });
      if (!item) return null;
      if (!item.images.some((image) => image.id === imageId)) throw new InventoryImageNotFoundError(imageId);
      await tx.inventoryImage.delete({ where: { id: imageId } });
      return tx.inventoryItem.findUniqueOrThrow({ where: { id: itemId }, include: itemInclude });
    });
  }

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
