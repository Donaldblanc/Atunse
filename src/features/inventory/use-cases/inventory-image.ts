// An Inventory Item's Product Images: attaches an uploaded key, or removes
// one. Admin-only (ADR-0012). Keys must sit under the item's own
// `inventory/<id>/` prefix; adding the same key twice is refused
// (InventoryImageKeyTakenError); removing an image that's already gone throws
// InventoryImageNotFoundError, which the caller reads as "already removed".

import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { InventoryItemNotFoundError, type InventoryItemRecord, type InventoryRepository } from "../repositories/inventory-repository";
import { InventoryValidationError } from "./inventory-validation";

export interface InventoryImageDeps {
  inventory: Pick<InventoryRepository, "addItemImage" | "removeItemImage">;
}

export async function addInventoryImage(deps: InventoryImageDeps, actingUser: ActingUser, itemId: string, key: string): Promise<InventoryItemRecord> {
  requireRole(actingUser, "ADMIN");
  const prefix = `inventory/${itemId}/`;
  if (!key.startsWith(prefix) || key.length === prefix.length || key.includes("..")) throw new InventoryValidationError("That image wasn't uploaded for this item.");
  const updated = await deps.inventory.addItemImage(itemId, key);
  if (!updated) throw new InventoryItemNotFoundError();
  return updated;
}

export async function removeInventoryImage(deps: InventoryImageDeps, actingUser: ActingUser, itemId: string, imageId: string): Promise<InventoryItemRecord> {
  requireRole(actingUser, "ADMIN");
  const updated = await deps.inventory.removeItemImage(itemId, imageId);
  if (!updated) throw new InventoryItemNotFoundError();
  return updated;
}
