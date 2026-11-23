// Every link on the Inventory screen (/admin/inventory) is built here from
// the current query plus overrides, so filters, the page, the open item and
// its tab survive paging, opening a row and closing a panel.

import type { InventoryQuery } from "./repositories/inventory-repository";

export const INVENTORY_TABS = ["details", "history", "supplier"] as const;
export type InventoryTab = (typeof INVENTORY_TABS)[number];

export function parseInventoryTab(value: string | string[] | undefined): InventoryTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return (INVENTORY_TABS as readonly string[]).includes(tab ?? "") ? (tab as InventoryTab) : "details";
}

export interface InventoryHrefOverrides {
  /** Replaces the query's page (1 and below leave it out). */
  page?: number;
  /** The item whose panel is open; omitted when absent. */
  item?: string | null;
  /** The panel's tab; "details" is the default and left out. */
  tab?: InventoryTab | null;
  /** The Add Item dialog. */
  isNew?: boolean;
}

/** "/admin/inventory?..." keeping the current search and filters unless an override replaces them. */
export function inventoryHref(query: InventoryQuery, overrides: InventoryHrefOverrides = {}): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.status) params.set("status", query.status);
  if (query.supplierId) params.set("supplierId", query.supplierId);
  const page = overrides.page ?? query.page;
  if (page > 1) params.set("page", String(page));
  if (overrides.item) params.set("item", overrides.item);
  if (overrides.item && overrides.tab && overrides.tab !== "details") params.set("tab", overrides.tab);
  if (overrides.isNew) params.set("new", "1");
  const search = params.toString();
  return search ? `/admin/inventory?${search}` : "/admin/inventory";
}

/** Up to `width` page numbers around the current page, for the pager's links. */
export function pageNumbers(page: number, pageCount: number, width = 5): number[] {
  const count = Math.min(width, pageCount);
  const start = Math.max(1, Math.min(page - Math.floor(width / 2), pageCount - count + 1));
  return Array.from({ length: count }, (_, index) => start + index);
}
