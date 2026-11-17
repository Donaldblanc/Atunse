import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { validateMoney } from "@/features/services/use-cases/update-catalog-item";
import { InventoryItemNotFoundError, type InventoryItemInput, type InventoryItemRecord, type InventoryRepository } from "../repositories/inventory-repository";
import { InventoryValidationError } from "./inventory-validation";

export { InventoryValidationError };

export const INVENTORY_CATEGORIES = ["Cleaning", "Laces", "Restoration", "Supplies"] as const;
export const ITEM_NAME_MAX = 100;
export const ITEM_DESCRIPTION_MAX = 500;
export const ITEM_SKU_MAX = 40;
export const ITEM_BRAND_MAX = 100;
export const STOCK_LEVEL_MAX = 10_000;

/** What the forms submit: text fields untrimmed, money already in cents (null when left blank). */
export interface InventoryItemRequest {
  name: string;
  description: string;
  sku: string;
  brand: string;
  category: string;
  lowStockAt: number;
  unitCostCents: number | null;
  sellingPriceCents: number | null;
  supplierId: string | null;
  active: boolean;
}

type ItemDeps = { inventory: Pick<InventoryRepository, "listSuppliers"> };

function money(cents: number | null, label: string): number | null {
  if (cents === null) return null;
  try {
    validateMoney(cents, label);
  } catch (err) {
    throw new InventoryValidationError(err instanceof Error ? err.message : `${label} isn't valid.`);
  }
  return cents;
}

function wholeNumber(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0 || value > STOCK_LEVEL_MAX) throw new InventoryValidationError(`${label} must be a whole number from 0 to ${STOCK_LEVEL_MAX.toLocaleString("en-US")}.`);
  return value;
}

async function validate(deps: ItemDeps, input: InventoryItemRequest): Promise<InventoryItemInput> {
  const name = input.name.trim();
  if (!name || name.length > ITEM_NAME_MAX) throw new InventoryValidationError(`Item name must be 1-${ITEM_NAME_MAX} characters.`);
  const description = input.description.trim();
  if (description.length > ITEM_DESCRIPTION_MAX) throw new InventoryValidationError(`Description must be at most ${ITEM_DESCRIPTION_MAX} characters.`);
  const sku = input.sku.trim();
  if (sku.length > ITEM_SKU_MAX) throw new InventoryValidationError(`SKU must be at most ${ITEM_SKU_MAX} characters.`);
  const brand = input.brand.trim();
  if (brand.length > ITEM_BRAND_MAX) throw new InventoryValidationError(`Brand must be at most ${ITEM_BRAND_MAX} characters.`);
  if (!(INVENTORY_CATEGORIES as readonly string[]).includes(input.category)) throw new InventoryValidationError("Pick a valid category.");
  const lowStockAt = wholeNumber(input.lowStockAt, "Low stock alert");
  const unitCostCents = money(input.unitCostCents, "Unit cost");
  const sellingPriceCents = money(input.sellingPriceCents, "Selling price");
  const supplierId = input.supplierId || null;
  if (supplierId && !(await deps.inventory.listSuppliers()).some((supplier) => supplier.id === supplierId)) throw new InventoryValidationError("Pick a valid supplier.");
  return {
    name,
    description: description || null,
    sku: sku || null,
    brand: brand || null,
    category: input.category,
    lowStockAt,
    unitCostCents,
    sellingPriceCents,
    supplierId,
    active: input.active,
  };
}

/** Add Item. Throws InventoryValidationError, InventorySkuTakenError. */
export async function createInventoryItem(
  deps: ItemDeps & { inventory: Pick<InventoryRepository, "createItem"> },
  actingUser: ActingUser,
  input: InventoryItemRequest & { initialStock: number },
): Promise<InventoryItemRecord> {
  requireRole(actingUser, "ADMIN");
  const valid = await validate(deps, input);
  const initialStock = wholeNumber(input.initialStock, "Initial stock");
  return deps.inventory.createItem(valid, initialStock, actingUser.accountId);
}

/** The Details panel's Save Changes. Never changes stock. Throws InventoryValidationError, InventoryChangedError, InventorySkuTakenError, InventoryItemNotFoundError. */
export async function updateInventoryItem(
  deps: ItemDeps & { inventory: Pick<InventoryRepository, "updateItem"> },
  actingUser: ActingUser,
  input: InventoryItemRequest & { itemId: string; expectedUpdatedAt: Date },
): Promise<InventoryItemRecord> {
  requireRole(actingUser, "ADMIN");
  const valid = await validate(deps, input);
  const updated = await deps.inventory.updateItem(input.itemId, valid, input.expectedUpdatedAt);
  if (!updated) throw new InventoryItemNotFoundError();
  return updated;
}

/** Delete Item (deactivate) or turning an item back on. */
export async function setInventoryItemActive(
  deps: { inventory: Pick<InventoryRepository, "setItemActive"> },
  actingUser: ActingUser,
  itemId: string,
  active: boolean,
): Promise<InventoryItemRecord> {
  requireRole(actingUser, "ADMIN");
  const updated = await deps.inventory.setItemActive(itemId, active);
  if (!updated) throw new InventoryItemNotFoundError();
  return updated;
}
