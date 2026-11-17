import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { InventoryItemRecord, InventoryRepository, StockMovementRecord, SupplierRecord } from "../repositories/inventory-repository";

export interface InventoryItemDetail {
  item: InventoryItemRecord;
  movements: StockMovementRecord[];
  supplier: SupplierRecord | null;
}

/** The item panel's data: the item, its Stock History and its supplier. Null when the item doesn't exist. */
export async function getInventoryItem(
  deps: { inventory: Pick<InventoryRepository, "getItem" | "listMovements" | "listSuppliers"> },
  actingUser: ActingUser,
  id: string,
): Promise<InventoryItemDetail | null> {
  requireRole(actingUser, "ADMIN");
  const item = await deps.inventory.getItem(id);
  if (!item) return null;
  const [movements, suppliers] = await Promise.all([deps.inventory.listMovements(id), item.supplierId ? deps.inventory.listSuppliers() : Promise.resolve([])]);
  return { item, movements, supplier: suppliers.find((supplier) => supplier.id === item.supplierId) ?? null };
}
