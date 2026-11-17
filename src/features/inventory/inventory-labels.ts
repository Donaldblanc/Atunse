// Display labels for the Inventory screen. Status is derived from stock
// (stockStatus), never stored; an inactive item reads "Inactive" instead.

import { stockStatus, type InventoryItemRecord, type InventoryStatusFilter, type StockMovementRecord } from "./repositories/inventory-repository";

export const STATUS_LABELS: Record<InventoryStatusFilter, string> = {
  IN_STOCK: "In Stock",
  LOW_STOCK: "Low Stock",
  OUT_OF_STOCK: "Out of Stock",
  INACTIVE: "Inactive",
};

export const FILTER_STATUSES: InventoryStatusFilter[] = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "INACTIVE"];

export const MOVEMENT_REASON_LABELS: Record<StockMovementRecord["reason"], string> = {
  RESTOCK: "Restocked",
  USED: "Used",
  ADJUSTMENT: "Adjusted",
};

export function itemStatus(item: Pick<InventoryItemRecord, "active" | "stock" | "lowStockAt">): InventoryStatusFilter {
  return item.active ? stockStatus(item) : "INACTIVE";
}

/** "+10" / "−3" (a real minus sign). */
export function signedChange(change: number): string {
  return change > 0 ? `+${change}` : `−${Math.abs(change)}`;
}
