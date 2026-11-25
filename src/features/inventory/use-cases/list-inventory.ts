import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { InventoryList, InventoryQuery, InventoryRepository, InventoryStatusFilter } from "../repositories/inventory-repository";

export const INVENTORY_PAGE_SIZE = 20;
export const INVENTORY_SEARCH_MAX = 100;

const STATUS_FILTERS: readonly InventoryStatusFilter[] = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "INACTIVE"];

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Reads the screen's URL params; anything unrecognised falls back to "no filter" rather than erroring. */
export function parseInventoryQuery(params: Record<string, string | string[] | undefined>): InventoryQuery {
  const status = first(params.status);
  const page = Number.parseInt(first(params.page), 10);
  return {
    q: first(params.q).trim().slice(0, INVENTORY_SEARCH_MAX),
    category: first(params.category).trim(),
    status: (STATUS_FILTERS as readonly string[]).includes(status) ? (status as InventoryStatusFilter) : "",
    supplierId: first(params.supplierId).trim(),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

export async function listInventory(
  deps: { inventory: Pick<InventoryRepository, "listItems"> },
  actingUser: ActingUser,
  query: InventoryQuery,
): Promise<InventoryList> {
  requireRole(actingUser, "ADMIN");
  return deps.inventory.listItems(query, INVENTORY_PAGE_SIZE);
}
