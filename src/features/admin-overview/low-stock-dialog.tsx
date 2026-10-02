import { randomUUID } from "node:crypto";
import type { LowStockItem } from "@/features/inventory/repositories/inventory-repository";
import { AdminDialog } from "@/shared/ui/admin-dialog";
import { StockAdjustForm } from "./stock-adjust-form";
import "@/styles/overview-stock-reviews.css";

/** The dialog behind Needs Attention's Low Stock Items (`?attention=low-stock`): each item with its Adjust stock form. */
export function LowStockDialog({ items, closeHref }: { items: LowStockItem[]; closeHref: string }) {
  return (
    <AdminDialog title={`Low Stock Items (${items.length})`} closeHref={closeHref} size="lg">
      {items.length === 0 ? (
        <p className="ov-empty">Nothing is running low.</p>
      ) : (
        <ul className="stk-list">
          {items.map((item) => (
            <li key={item.id} className="stk-item">
              <div className="stk-head">
                <div>
                  <span className="ov-cell-main">{item.name}</span>{" "}
                  <span className="ov-cell-sub">{[item.sku, item.category].filter(Boolean).join(" · ")}</span>
                </div>
                <span className="stk-level" data-out={item.stock === 0 ? "true" : undefined}>
                  {item.stock} in stock <span className="ov-cell-sub">(low at {item.lowStockAt})</span>
                </span>
              </div>
              {/* Keyed by the stock it shows, so a saved change gives the form a fresh key and the new seenStock. */}
              <StockAdjustForm key={`${item.id}:${item.stock}`} itemId={item.id} seenStock={item.stock} idempotencyKey={randomUUID()} />
            </li>
          ))}
        </ul>
      )}
    </AdminDialog>
  );
}
