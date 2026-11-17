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

// ---- Inventory screen (/admin/inventory) ----

/** Derived, never stored: 0 is out, at or below lowStockAt is low. */
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
/** The filter values the screen accepts: a stock status, or "INACTIVE" for deactivated items. */
export type InventoryStatusFilter = StockStatus | "INACTIVE";

export function stockStatus(item: { stock: number; lowStockAt: number }): StockStatus {
  if (item.stock <= 0) return "OUT_OF_STOCK";
  if (item.stock <= item.lowStockAt) return "LOW_STOCK";
  return "IN_STOCK";
}

export const MAX_INVENTORY_IMAGES = 5;

export interface InventoryImage {
  id: string;
  key: string;
  position: number;
}

export interface SupplierRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
}

export interface InventoryItemRecord {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  brand: string | null;
  category: string;
  stock: number;
  lowStockAt: number;
  unitCostCents: number | null;
  sellingPriceCents: number | null;
  supplierId: string | null;
  active: boolean;
  images: InventoryImage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StockMovementRecord {
  id: string;
  change: number;
  reason: "RESTOCK" | "USED" | "ADJUSTMENT";
  note: string | null;
  orderId: string | null;
  actorAccountId: string | null;
  createdAt: Date;
}

export interface InventoryQuery {
  q: string;
  category: string;
  status: InventoryStatusFilter | "";
  supplierId: string;
  /** 1-based. */
  page: number;
}

export interface InventoryStats {
  total: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

export interface InventoryList {
  rows: InventoryItemRecord[];
  total: number;
  page: number;
  pageCount: number;
  /** Active items only, whatever the filters (matches countLowStock). */
  stats: InventoryStats;
}

export interface InventoryItemInput {
  name: string;
  description: string | null;
  sku: string | null;
  brand: string | null;
  category: string;
  lowStockAt: number;
  unitCostCents: number | null;
  sellingPriceCents: number | null;
  supplierId: string | null;
  active: boolean;
}

export interface NewSupplierInput {
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
}

/** Another save landed since the form was loaded (its `updatedAt` no longer matches). Nothing was written. */
export class InventoryChangedError extends Error {
  constructor() {
    super("This was changed elsewhere. Reload and try again.");
    this.name = "InventoryChangedError";
  }
}

export class InventorySkuTakenError extends Error {
  constructor(readonly sku: string) {
    super("Another item already uses that SKU.");
    this.name = "InventorySkuTakenError";
  }
}

export class InventoryImageKeyTakenError extends Error {
  constructor(readonly key: string) {
    super("That image is already attached.");
    this.name = "InventoryImageKeyTakenError";
  }
}

export class InventoryImageNotFoundError extends Error {
  constructor(readonly imageId: string) {
    super("Image not found.");
    this.name = "InventoryImageNotFoundError";
  }
}

export class TooManyInventoryImagesError extends Error {
  constructor() {
    super(`An item can have at most ${MAX_INVENTORY_IMAGES} images.`);
    this.name = "TooManyInventoryImagesError";
  }
}

export interface InventoryRepository {
  /** Active and inactive items, name A-Z, `pageSize` per page. Search `q` matches name, SKU and brand. */
  listItems(query: InventoryQuery, pageSize: number): Promise<InventoryList>;
  getItem(id: string): Promise<InventoryItemRecord | null>;
  /** Newest first. */
  listMovements(itemId: string, limit?: number): Promise<StockMovementRecord[]>;
  /**
   * One transaction: the item with `stock = initialStock`, plus a RESTOCK
   * movement ("Initial stock") when initialStock > 0.
   * @throws InventorySkuTakenError
   */
  createItem(input: InventoryItemInput, initialStock: number, actorAccountId: string | null): Promise<InventoryItemRecord>;
  /**
   * Never touches stock. Null if the item doesn't exist.
   * @throws InventoryChangedError when `updatedAt` no longer matches, InventorySkuTakenError
   */
  updateItem(id: string, patch: Partial<InventoryItemInput>, expectedUpdatedAt: Date): Promise<InventoryItemRecord | null>;
  /** Delete Item deactivates; items are never deleted since movements reference them. */
  setItemActive(id: string, active: boolean): Promise<InventoryItemRecord | null>;
  listSuppliers(): Promise<SupplierRecord[]>;
  createSupplier(input: NewSupplierInput): Promise<SupplierRecord>;
  /** Null if the item doesn't exist. @throws TooManyInventoryImagesError, InventoryImageKeyTakenError */
  addItemImage(itemId: string, key: string): Promise<InventoryItemRecord | null>;
  /** Null if the item doesn't exist. @throws InventoryImageNotFoundError */
  removeItemImage(itemId: string, imageId: string): Promise<InventoryItemRecord | null>;

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
