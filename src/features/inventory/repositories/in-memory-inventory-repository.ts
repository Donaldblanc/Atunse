// Test double for the InventoryRepository seam (see the Prisma version).

import {
  InventoryItemNotFoundError,
  NegativeStockError,
  StockChangedError,
  type AdjustStockInput,
  type InventoryRepository,
  type LowStockItem,
} from "./inventory-repository";

export interface InMemoryInventoryItem extends LowStockItem {
  active: boolean;
}

export interface InMemoryStockMovement {
  itemId: string;
  change: number;
  reason: AdjustStockInput["reason"];
  note: string | null;
  actorAccountId: string | null;
}

export class InMemoryInventoryRepository implements InventoryRepository {
  readonly movements: InMemoryStockMovement[] = [];

  constructor(readonly items: InMemoryInventoryItem[] = []) {}

  private low(): InMemoryInventoryItem[] {
    return this.items.filter((item) => item.active && item.stock <= item.lowStockAt);
  }

  async countLowStock(): Promise<number> {
    return this.low().length;
  }

  async listLowStock(): Promise<LowStockItem[]> {
    return this.low()
      .map(({ active: _active, ...item }) => item)
      .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
  }

  async adjustStock(input: AdjustStockInput): Promise<{ stock: number }> {
    const item = this.items.find((candidate) => candidate.id === input.itemId);
    if (!item) throw new InventoryItemNotFoundError();
    if (item.stock !== input.seenStock) throw new StockChangedError(item.stock);
    const next = item.stock + input.change;
    if (next < 0) throw new NegativeStockError(item.stock);
    item.stock = next;
    this.movements.push({ itemId: input.itemId, change: input.change, reason: input.reason, note: input.note, actorAccountId: input.actorAccountId });
    return { stock: next };
  }
}
