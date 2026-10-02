// The InventoryRepository seam (ADR-0003/0011): supplies stock, and the one
// way stock changes. Only the Prisma implementation imports Prisma.

export const STOCK_ADJUST_REASONS = ["RESTOCK", "ADJUSTMENT"] as const;
export type StockAdjustReason = (typeof STOCK_ADJUST_REASONS)[number];

export interface LowStockItem {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  stock: number;
  lowStockAt: number;
}

export interface AdjustStockInput {
  itemId: string;
  /** Non-zero; positive restocks, negative uses up. */
  change: number;
  reason: StockAdjustReason;
  note: string | null;
  /** The stock the admin saw; the write is refused if it has moved since. */
  seenStock: number;
  actorAccountId: string | null;
}

export class InventoryItemNotFoundError extends Error {
  constructor() {
    super("Inventory item not found");
    this.name = "InventoryItemNotFoundError";
  }
}

/** The item's stock is no longer what the admin saw (another tab, or a replay). */
export class StockChangedError extends Error {
  constructor(public readonly currentStock: number) {
    super("Stock changed since it was loaded");
    this.name = "StockChangedError";
  }
}

export class NegativeStockError extends Error {
  constructor(public readonly currentStock: number) {
    super("Stock can't go below 0");
    this.name = "NegativeStockError";
  }
}

export interface InventoryRepository {
  /** Active items with stock <= lowStockAt. */
  countLowStock(): Promise<number>;
  /** The same set, lowest stock first, then by name. */
  listLowStock(): Promise<LowStockItem[]>;
  /**
   * In one transaction: updates stock (only if it still equals `seenStock`)
   * and writes the StockMovement. Returns the new stock.
   * @throws InventoryItemNotFoundError, StockChangedError, NegativeStockError
   */
  adjustStock(input: AdjustStockInput): Promise<{ stock: number }>;
}
