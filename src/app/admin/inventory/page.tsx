// The admin Inventory screen: stat cards, a filterable/searchable/paged table
// of Inventory Items, an item side panel for the row picked with `?item=`, and
// the Add Item dialog (`?new=1`). Status is derived from stock; there's no
// delete (Stock History names the item), only Deactivate.

import { cookies } from "next/headers";
import Link from "next/link";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { AdminDialog } from "@/shared/ui/admin-dialog";
import type { FileStorage } from "@/shared/storage";
import { buildInventoryDeps } from "@/features/inventory/deps";
import { inventoryHref, pageNumbers, parseInventoryTab } from "@/features/inventory/inventory-href";
import { InventoryItemForm } from "@/features/inventory/inventory-item-form";
import { FILTER_STATUSES, STATUS_LABELS } from "@/features/inventory/inventory-labels";
import { InventoryPanel } from "@/features/inventory/inventory-panel";
import { InventoryTable } from "@/features/inventory/inventory-table";
import type { InventoryImage } from "@/features/inventory/repositories/inventory-repository";
import { getInventoryItem } from "@/features/inventory/use-cases/get-inventory-item";
import { INVENTORY_PAGE_SIZE, INVENTORY_SEARCH_MAX, listInventory, parseInventoryQuery } from "@/features/inventory/use-cases/list-inventory";
import { INVENTORY_CATEGORIES } from "@/features/inventory/use-cases/save-inventory-item";
import { listSuppliers } from "@/features/inventory/use-cases/suppliers";
import "@/features/inventory/inventory-screen.css";

export const metadata = { title: "Inventory · Atunṣe Admin" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** Short-lived view links for item images (the bucket is private). A link that can't be made (storage not set up) is null: the screen shows a placeholder instead of failing. */
async function viewUrls(deps: { storage: FileStorage }, images: InventoryImage[]): Promise<Record<string, string | null>> {
  const entries = await Promise.all(
    images.map(async (image): Promise<[string, string | null]> => {
      try {
        return [image.id, await deps.storage.createViewUrl(image.key)];
      } catch {
        return [image.id, null];
      }
    }),
  );
  return Object.fromEntries(entries);
}

export default async function AdminInventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actingUser = await actingUserFromCookies(await cookies());
  const query = parseInventoryQuery(params);

  const deps = buildInventoryDeps();
  const list = await listInventory(deps, actingUser, query);
  const suppliers = await listSuppliers(deps, actingUser);
  const listQuery = { ...query, page: list.page };
  const baseHref = inventoryHref(listQuery);

  const itemId = typeof params.item === "string" && params.item ? params.item : null;
  const detail = itemId ? await getInventoryItem(deps, actingUser, itemId) : null;
  const tab = parseInventoryTab(params.tab);
  const adding = params.new === "1";

  const thumbnailImages = list.rows.flatMap((row) => (row.images[0] ? [{ ...row.images[0], id: row.id }] : []));
  const [thumbnails, imageUrls] = await Promise.all([viewUrls(deps, thumbnailImages), viewUrls(deps, detail?.item.images ?? [])]);

  const first = (list.page - 1) * INVENTORY_PAGE_SIZE + (list.rows.length > 0 ? 1 : 0);
  const last = (list.page - 1) * INVENTORY_PAGE_SIZE + list.rows.length;

  return (
    <div className="ov ov-page inv">
      <div className="ov-header">
        <div>
          <p className="ov-eyebrow">Inventory</p>
          <h1 className="ov-title">Inventory</h1>
          <p className="inv-subtitle">Track and manage your supplies and products.</p>
        </div>
        <Link className="admin-btn" href={inventoryHref(listQuery, { isNew: true })} scroll={false}>
          <PlusIcon size={16} aria-hidden="true" /> Add Item
        </Link>
      </div>

      <div className="inv-stats">
        <StatCard label="Total Items" value={list.stats.total} tone="total" />
        <StatCard label="In Stock" value={list.stats.inStock} tone="in" />
        <StatCard label="Low Stock" value={list.stats.lowStock} tone="low" />
        <StatCard label="Out of Stock" value={list.stats.outOfStock} tone="out" />
      </div>

      <div className="inv-body">
        <div className="inv-main">
          <form action="/admin/inventory" method="get" role="search" className="inv-toolbar">
            <label htmlFor="inv-q" className="sr-only">
              Search inventory items
            </label>
            <input id="inv-q" name="q" type="search" className="att-search-input" maxLength={INVENTORY_SEARCH_MAX} defaultValue={query.q} placeholder="Search by name, SKU or brand…" />
            <select name="category" className="inv-select" defaultValue={query.category} aria-label="Category">
              <option value="">All categories</option>
              {INVENTORY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select name="status" className="inv-select" defaultValue={query.status} aria-label="Status">
              <option value="">All status</option>
              {FILTER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <select name="supplierId" className="inv-select" defaultValue={query.supplierId} aria-label="Supplier">
              <option value="">All suppliers</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <button type="submit" className="admin-btn">
              Search
            </button>
            {(query.q || query.category || query.status || query.supplierId) && (
              <Link className="inv-reset" href="/admin/inventory">
                Reset
              </Link>
            )}
          </form>

          <InventoryTable rows={list.rows} thumbnails={thumbnails} buildDetailHref={(id) => inventoryHref(listQuery, { item: id })} selectedId={itemId} />

          {list.total > 0 && (
            <nav className="inv-pages" aria-label="Pages">
              <span className="ov-cell-sub">
                Showing {first}–{last} of {list.total} items
              </span>
              {list.pageCount > 1 && (
                <div className="inv-pager">
                  {list.page > 1 ? (
                    <Link className="inv-page" href={inventoryHref(listQuery, { page: list.page - 1 })} rel="prev" aria-label="Previous page">
                      ‹
                    </Link>
                  ) : (
                    <span className="inv-page" aria-disabled="true">
                      ‹
                    </span>
                  )}
                  {pageNumbers(list.page, list.pageCount).map((number) => (
                    <Link key={number} className="inv-page" href={inventoryHref(listQuery, { page: number })} aria-current={number === list.page ? "page" : undefined}>
                      {number}
                    </Link>
                  ))}
                  {list.page < list.pageCount ? (
                    <Link className="inv-page" href={inventoryHref(listQuery, { page: list.page + 1 })} rel="next" aria-label="Next page">
                      ›
                    </Link>
                  ) : (
                    <span className="inv-page" aria-disabled="true">
                      ›
                    </span>
                  )}
                </div>
              )}
            </nav>
          )}
        </div>

        {itemId && <InventoryPanel detail={detail} itemId={itemId} query={listQuery} tab={tab} suppliers={suppliers} imageUrls={imageUrls} stockKey={crypto.randomUUID()} />}
      </div>

      {adding && (
        <AdminDialog title="Add Item" closeHref={baseHref} size="sm">
          <InventoryItemForm suppliers={suppliers} cancelHref={baseHref} idempotencyKey={crypto.randomUUID()} />
        </AdminDialog>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "total" | "in" | "low" | "out" }) {
  return (
    <div className="inv-card" data-tone={tone}>
      <span className="inv-card-icon" aria-hidden="true" />
      <div>
        <p className="inv-card-label">{label}</p>
        <p className="inv-card-value">{value}</p>
      </div>
    </div>
  );
}
