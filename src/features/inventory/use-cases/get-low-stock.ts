import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { InventoryRepository, LowStockItem } from "../repositories/inventory-repository";

/** The Overview's Low Stock count. Admin-only (ADR-0012). */
export async function getLowStockCount(deps: { inventory: Pick<InventoryRepository, "countLowStock"> }, actingUser: ActingUser): Promise<number> {
  requireRole(actingUser, "ADMIN");
  return deps.inventory.countLowStock();
}

/** The items behind `?attention=low-stock`. Admin-only. */
export async function getLowStockItems(deps: { inventory: Pick<InventoryRepository, "listLowStock"> }, actingUser: ActingUser): Promise<LowStockItem[]> {
  requireRole(actingUser, "ADMIN");
  return deps.inventory.listLowStock();
}
