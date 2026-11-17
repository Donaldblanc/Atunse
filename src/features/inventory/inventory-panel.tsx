// The Inventory screen's right-side item panel (design: scratch/inventory.jpeg),
// opened by `?item=`: Details (edit form, read-only stock with Adjust stock,
// Product Images, Deactivate), Stock History and Supplier. Status is derived
// from stock, so the design's status dropdown isn't here.

import Link from "next/link";
import { Money } from "@/shared/money/money";
import { inventoryHref, INVENTORY_TABS, type InventoryTab } from "./inventory-href";
import { InventoryActiveButton } from "./inventory-active-button";
import { InventoryImageUploader } from "./inventory-image-uploader";
import { InventoryItemForm } from "./inventory-item-form";
import { InventoryStockForm } from "./inventory-stock-form";
import { InventorySupplierForm } from "./inventory-supplier-form";
import { itemStatus, MOVEMENT_REASON_LABELS, signedChange, STATUS_LABELS } from "./inventory-labels";
import type { InventoryQuery, SupplierRecord } from "./repositories/inventory-repository";
import type { InventoryItemDetail } from "./use-cases/get-inventory-item";

const TAB_LABELS: Record<InventoryTab, string> = { details: "Details", history: "Stock History", supplier: "Supplier" };
const dateTimeFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export function InventoryPanel({
  detail,
  itemId,
  query,
  tab,
  suppliers,
  imageUrls,
  stockKey,
}: {
  /** Null when `?item=` names an item that doesn't exist. */
  detail: InventoryItemDetail | null;
  itemId: string;
  query: InventoryQuery;
  tab: InventoryTab;
  suppliers: SupplierRecord[];
  imageUrls: Record<string, string | null>;
  /** Made per render, so a replayed Adjust stock is told apart from a new one. */
  stockKey: string;
}) {
  const closeHref = inventoryHref(query);

  if (!detail) {
    return (
      <aside className="inv-panel" aria-label="Item details">
        <div className="inv-panel-head">
          <h2 className="inv-panel-title">Item not found</h2>
          <Link href={closeHref} scroll={false} className="inv-panel-close" aria-label="Close">
            ×
          </Link>
        </div>
        <p className="ov-empty">This item no longer exists.</p>
      </aside>
    );
  }

  const { item, movements, supplier } = detail;
  const status = itemStatus(item);

  return (
    <aside className="inv-panel" aria-label="Item details">
      <div className="inv-panel-head">
        <div>
          <h2 className="inv-panel-title">{item.name}</h2>
          <span className="inv-status" data-status={status}>
            {STATUS_LABELS[status]}
          </span>
        </div>
        <Link href={closeHref} scroll={false} className="inv-panel-close" aria-label="Close">
          ×
        </Link>
      </div>

      <nav className="inv-tabs" aria-label="Item sections">
        {INVENTORY_TABS.map((id) => (
          <Link key={id} href={inventoryHref(query, { item: itemId, tab: id })} scroll={false} replace className="inv-tab" aria-current={id === tab ? "page" : undefined}>
            {TAB_LABELS[id]}
          </Link>
        ))}
      </nav>

      {tab === "details" && (
        <>
          <InventoryItemForm item={item} suppliers={suppliers} />

          <section className="inv-panel-section">
            <h3 className="inv-section-title">Stock</h3>
            <p className="inv-stock-now">
              Current stock <strong>{item.stock}</strong>
            </p>
            <InventoryStockForm key={item.stock} itemId={item.id} seenStock={item.stock} idempotencyKey={stockKey} />
          </section>

          <section className="inv-panel-section">
            <InventoryImageUploader itemId={item.id} images={item.images} urls={imageUrls} />
          </section>

          <section className="inv-panel-section">
            <InventoryActiveButton itemId={item.id} itemName={item.name} active={item.active} returnTo={inventoryHref(query, { item: item.id })} />
          </section>
        </>
      )}

      {tab === "history" && (
        <section className="inv-panel-section">
          {movements.length === 0 ? (
            <p className="ov-empty">No stock changes yet.</p>
          ) : (
            <ul className="inv-history">
              {movements.map((movement) => (
                <li key={movement.id}>
                  <span className="inv-history-change" data-direction={movement.change > 0 ? "up" : "down"}>
                    {signedChange(movement.change)}
                  </span>
                  <div>
                    <p className="inv-history-reason">{MOVEMENT_REASON_LABELS[movement.reason]}</p>
                    <p className="ov-cell-sub">{dateTimeFormat.format(movement.createdAt)}</p>
                    {movement.note && <p className="inv-history-note">{movement.note}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "supplier" && (
        <>
          <section className="inv-panel-section">
            {supplier ? (
              <dl className="inv-facts">
                <div>
                  <dt>Supplier</dt>
                  <dd>{supplier.name}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{supplier.email ?? "—"}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{supplier.phone ?? "—"}</dd>
                </div>
                <div>
                  <dt>Website</dt>
                  <dd>{supplier.website ?? "—"}</dd>
                </div>
                <div>
                  <dt>Notes</dt>
                  <dd>{supplier.notes ?? "—"}</dd>
                </div>
                {item.unitCostCents !== null && (
                  <div>
                    <dt>Unit cost</dt>
                    <dd>{Money.fromCents(item.unitCostCents).format()}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="ov-empty">No supplier</p>
            )}
          </section>
          <section className="inv-panel-section">
            <InventorySupplierForm />
          </section>
        </>
      )}
    </aside>
  );
}
