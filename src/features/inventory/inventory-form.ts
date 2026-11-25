// What the Inventory screen's forms submit, read into the use-case shapes,
// and the messages for the named errors the use-cases throw. Plain module
// (not "use server") so both the actions and their tests can import it.

import { UnauthorizedError } from "@/features/accounts/authz";
import { parseDollarsToCents } from "@/features/services/dollars";
import { InventoryChangedError, InventoryImageKeyTakenError, InventoryItemNotFoundError, InventorySkuTakenError, TooManyInventoryImagesError } from "./repositories/inventory-repository";
import { InventoryValidationError } from "./use-cases/save-inventory-item";
import type { InventoryItemRequest } from "./use-cases/save-inventory-item";

export type InventoryFormState = { error: string | null; /** Bumped on each success so a form can show "Saved". */ done: number };

export const NOT_VALID = "That request wasn't valid. Reload and try again.";

export const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

/** A database id (cuid): the only shape an id field may take. */
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const INTEGER_PATTERN = /^[+-]?\d{1,9}$/;

/** A whole-number field: NaN for anything else, which the use-case rejects with its own message. */
export function wholeNumber(raw: string): number {
  const trimmed = raw.trim();
  return INTEGER_PATTERN.test(trimmed) ? Number(trimmed) : NaN;
}

/** The ISO `updatedAt` the edit form was rendered with; null if missing or malformed. */
export function expectedUpdatedAt(formData: FormData): Date | null {
  const date = new Date(text(formData, "updatedAt"));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Optional dollars field: blank is null, anything that isn't a price is an error. */
function optionalCents(formData: FormData, name: string, label: string): { cents: number | null } | { error: string } {
  const raw = text(formData, name).trim();
  if (raw === "") return { cents: null };
  const cents = parseDollarsToCents(raw);
  return Number.isNaN(cents) ? { error: `${label} must be a price like 8.50.` } : { cents };
}

/** The item fields shared by Add Item and the Details form. Stock is never part of an edit. */
export function parseItemRequest(formData: FormData, active: boolean): { request: InventoryItemRequest } | { error: string } {
  const unitCost = optionalCents(formData, "unitCostDollars", "Unit cost");
  if ("error" in unitCost) return unitCost;
  const sellingPrice = optionalCents(formData, "sellingPriceDollars", "Selling price");
  if ("error" in sellingPrice) return sellingPrice;
  const supplierId = text(formData, "supplierId");
  if (supplierId && !ID_PATTERN.test(supplierId)) return { error: NOT_VALID };
  return {
    request: {
      name: text(formData, "name"),
      description: text(formData, "description"),
      sku: text(formData, "sku"),
      brand: text(formData, "brand"),
      category: text(formData, "category"),
      lowStockAt: wholeNumber(text(formData, "lowStockAt")),
      unitCostCents: unitCost.cents,
      sellingPriceCents: sellingPrice.cents,
      supplierId: supplierId || null,
      active,
    },
  };
}

/** A message for the errors a use-case throws on purpose; null for anything unexpected (rethrow it). */
export function inventoryErrorMessage(err: unknown): string | null {
  if (err instanceof InventoryValidationError || err instanceof InventoryChangedError || err instanceof InventorySkuTakenError) return err.message;
  if (err instanceof TooManyInventoryImagesError || err instanceof InventoryImageKeyTakenError) return err.message;
  if (err instanceof InventoryItemNotFoundError) return "This item no longer exists.";
  if (err instanceof UnauthorizedError) return "You need to be signed in as an admin to do that.";
  return null;
}
