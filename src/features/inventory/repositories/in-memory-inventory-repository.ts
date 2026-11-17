// Test double for the InventoryRepository seam (see the Prisma version).

import {
  InventoryChangedError,
  InventoryImageKeyTakenError,
  InventoryImageNotFoundError,
  InventoryItemNotFoundError,
  InventorySkuTakenError,
  MAX_INVENTORY_IMAGES,
  NegativeStockError,
  StockChangedError,
  lowStockAlert,
  TooManyInventoryImagesError,
  stockStatus,
  type AdjustStockInput,
  type InventoryImage,
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

/** The fields the Overview tests need; everything else defaults (see `toRecord`). */
export interface InMemoryInventoryItem extends LowStockItem {
  active: boolean;
  description?: string | null;
  brand?: string | null;
  unitCostCents?: number | null;
  sellingPriceCents?: number | null;
  supplierId?: string | null;
  images?: InventoryImage[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface InMemoryStockMovement {
  itemId: string;
  change: number;
  reason: AdjustStockInput["reason"];
  note: string | null;
  actorAccountId: string | null;
}

const EPOCH = new Date(0);

function toRecord(item: InMemoryInventoryItem): InventoryItemRecord {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? null,
    sku: item.sku,
    brand: item.brand ?? null,
    category: item.category,
    stock: item.stock,
    lowStockAt: item.lowStockAt,
    unitCostCents: item.unitCostCents ?? null,
    sellingPriceCents: item.sellingPriceCents ?? null,
    supplierId: item.supplierId ?? null,
    active: item.active,
    images: [...(item.images ?? [])].sort((a, b) => a.position - b.position),
    createdAt: item.createdAt ?? EPOCH,
    updatedAt: item.updatedAt ?? EPOCH,
  };
}

export class InMemoryInventoryRepository implements InventoryRepository {
  readonly movements: InMemoryStockMovement[] = [];
  /** When each entry of `movements` happened, and the Order it was used on (kept apart so `movements` keeps its shape). */
  private readonly movementMeta: { createdAt: Date; orderId: string | null; reason: StockMovementRecord["reason"] }[] = [];
  /** Bell notifications written by adjustStock (kind LOW_STOCK), like the Prisma repository's notifications rows. */
  readonly notifications: { kind: "LOW_STOCK"; title: string; body: string }[] = [];
  readonly suppliers: SupplierRecord[] = [];
  private nextId = 1;

  constructor(readonly items: InMemoryInventoryItem[] = []) {}

  private low(): InMemoryInventoryItem[] {
    return this.items.filter((item) => item.active && item.stock <= item.lowStockAt);
  }

  /** Strictly after the previous stamp, so a stale `updatedAt` is always detectable. */
  private stamp(previous?: Date): Date {
    const now = Date.now();
    return new Date(previous && previous.getTime() >= now ? previous.getTime() + 1 : now);
  }

  private find(id: string): InMemoryInventoryItem | undefined {
    return this.items.find((candidate) => candidate.id === id);
  }

  private skuTaken(sku: string | null, exceptId?: string): boolean {
    return sku !== null && this.items.some((item) => item.id !== exceptId && item.sku === sku);
  }

  async countLowStock(): Promise<number> {
    return this.low().length;
  }

  async listLowStock(): Promise<LowStockItem[]> {
    return this.low()
      .map(({ id, name, sku, category, stock, lowStockAt }) => ({ id, name, sku, category, stock, lowStockAt }))
      .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
  }

  async adjustStock(input: AdjustStockInput): Promise<{ stock: number }> {
    const item = this.find(input.itemId);
    if (!item) throw new InventoryItemNotFoundError();
    if (item.stock !== input.seenStock) throw new StockChangedError(item.stock);
    const next = item.stock + input.change;
    if (next < 0) throw new NegativeStockError(item.stock);
    const alert = lowStockAlert(item, next);
    item.stock = next;
    item.updatedAt = this.stamp(item.updatedAt);
    if (alert) this.notifications.push({ kind: "LOW_STOCK", ...alert });
    this.movements.push({ itemId: input.itemId, change: input.change, reason: input.reason, note: input.note, actorAccountId: input.actorAccountId });
    this.movementMeta.push({ createdAt: new Date(), orderId: null, reason: input.reason });
    return { stock: next };
  }

  async listItems(query: InventoryQuery, pageSize: number): Promise<InventoryList> {
    const active = this.items.filter((item) => item.active);
    const stats = {
      total: active.length,
      inStock: active.filter((item) => stockStatus(item) === "IN_STOCK").length,
      lowStock: active.filter((item) => stockStatus(item) === "LOW_STOCK").length,
      outOfStock: active.filter((item) => stockStatus(item) === "OUT_OF_STOCK").length,
    };
    const q = query.q.trim().toLowerCase();
    const matching = this.items
      .filter((item) => {
        if (q && ![item.name, item.sku ?? "", item.brand ?? ""].some((field) => field.toLowerCase().includes(q))) return false;
        if (query.category && item.category !== query.category) return false;
        if (query.supplierId && (item.supplierId ?? null) !== query.supplierId) return false;
        if (query.status === "INACTIVE") return !item.active;
        if (query.status) return item.active && stockStatus(item) === query.status;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
    const page = Math.min(Math.max(1, query.page), pageCount);
    const rows = matching.slice((page - 1) * pageSize, page * pageSize).map(toRecord);
    return { rows, total: matching.length, page, pageCount, stats };
  }

  async getItem(id: string): Promise<InventoryItemRecord | null> {
    const item = this.find(id);
    return item ? toRecord(item) : null;
  }

  async listMovements(itemId: string, limit = 50): Promise<StockMovementRecord[]> {
    return this.movements
      .map((movement, index) => ({ movement, meta: this.movementMeta[index], index }))
      .flatMap((entry) => (entry.meta && entry.movement.itemId === itemId ? [{ ...entry, meta: entry.meta }] : []))
      .map(({ movement, meta, index }) => ({
        id: `m-${index}`,
        change: movement.change,
        reason: meta.reason,
        note: movement.note,
        orderId: meta.orderId,
        actorAccountId: movement.actorAccountId,
        createdAt: meta.createdAt,
        index,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.index - a.index)
      .slice(0, limit)
      .map(({ index: _index, ...record }) => record);
  }

  async createItem(input: InventoryItemInput, initialStock: number, actorAccountId: string | null): Promise<InventoryItemRecord> {
    if (this.skuTaken(input.sku)) throw new InventorySkuTakenError(input.sku as string);
    const now = this.stamp();
    const item: InMemoryInventoryItem = { ...input, id: `item-${this.nextId++}`, stock: initialStock, images: [], createdAt: now, updatedAt: now };
    this.items.push(item);
    if (initialStock > 0) {
      this.movements.push({ itemId: item.id, change: initialStock, reason: "RESTOCK", note: "Initial stock", actorAccountId });
      this.movementMeta.push({ createdAt: now, orderId: null, reason: "RESTOCK" });
    }
    return toRecord(item);
  }

  async updateItem(id: string, patch: Partial<InventoryItemInput>, expectedUpdatedAt: Date): Promise<InventoryItemRecord | null> {
    const item = this.find(id);
    if (!item) return null;
    if ((item.updatedAt ?? EPOCH).getTime() !== expectedUpdatedAt.getTime()) throw new InventoryChangedError();
    if (patch.sku !== undefined && this.skuTaken(patch.sku, id)) throw new InventorySkuTakenError(patch.sku as string);
    Object.assign(item, patch);
    item.updatedAt = this.stamp(item.updatedAt);
    return toRecord(item);
  }

  async setItemActive(id: string, active: boolean): Promise<InventoryItemRecord | null> {
    const item = this.find(id);
    if (!item) return null;
    item.active = active;
    item.updatedAt = this.stamp(item.updatedAt);
    return toRecord(item);
  }

  async listSuppliers(): Promise<SupplierRecord[]> {
    return [...this.suppliers].sort((a, b) => a.name.localeCompare(b.name));
  }

  async createSupplier(input: NewSupplierInput): Promise<SupplierRecord> {
    const supplier: SupplierRecord = { id: `supplier-${this.nextId++}`, ...input };
    this.suppliers.push(supplier);
    return supplier;
  }

  async addItemImage(itemId: string, key: string): Promise<InventoryItemRecord | null> {
    const item = this.find(itemId);
    if (!item) return null;
    const images = (item.images ??= []);
    if (images.length >= MAX_INVENTORY_IMAGES) throw new TooManyInventoryImagesError();
    if (this.items.some((other) => other.images?.some((image) => image.key === key))) throw new InventoryImageKeyTakenError(key);
    const position = images.reduce((max, image) => Math.max(max, image.position), -1) + 1;
    images.push({ id: `image-${this.nextId++}`, key, position });
    return toRecord(item);
  }

  async removeItemImage(itemId: string, imageId: string): Promise<InventoryItemRecord | null> {
    const item = this.find(itemId);
    if (!item) return null;
    const images = item.images ?? [];
    if (!images.some((image) => image.id === imageId)) throw new InventoryImageNotFoundError(imageId);
    item.images = images.filter((image) => image.id !== imageId);
    return toRecord(item);
  }
}
