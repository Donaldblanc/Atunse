"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createInventoryItemAction, updateInventoryItemAction } from "./inventory-actions";
import type { InventoryFormState } from "./inventory-form";
import type { InventoryItemRecord, SupplierRecord } from "./repositories/inventory-repository";
import { INVENTORY_CATEGORIES, ITEM_BRAND_MAX, ITEM_DESCRIPTION_MAX, ITEM_NAME_MAX, ITEM_SKU_MAX } from "./use-cases/save-inventory-item";

const dollars = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2));

/**
 * One form for Add Item (no `item`: adds an initial stock field, redirects to the
 * new item's panel) and the Details tab's Save Changes (stock is shown elsewhere,
 * read-only, and never submitted). `updatedAt` is the optimistic token: a save
 * from a stale form is refused.
 */
export function InventoryItemForm({ item, suppliers, cancelHref, idempotencyKey }: { item?: InventoryItemRecord; suppliers: SupplierRecord[]; cancelHref?: string; idempotencyKey?: string }) {
  const [state, formAction, pending] = useActionState<InventoryFormState, FormData>(item ? updateInventoryItemAction : createInventoryItemAction, { error: null, done: 0 });
  const [description, setDescription] = useState(item?.description ?? "");
  const id = item ? `inv-${item.id}` : "inv-new";

  return (
    // Keyed on the saved version so a successful save re-renders the fields from the server's values.
    <form action={formAction} className="inv-form" key={item?.updatedAt.toISOString()}>
      {item ? (
        <>
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="updatedAt" value={item.updatedAt.toISOString()} />
          <input type="hidden" name="active" value={String(item.active)} />
        </>
      ) : (
        <input type="hidden" name="idempotencyKey" value={idempotencyKey ?? ""} />
      )}

      <label className="inv-field" htmlFor={`${id}-name`}>
        <span className="inv-label">Item Name *</span>
        <input id={`${id}-name`} name="name" type="text" defaultValue={item?.name ?? ""} maxLength={ITEM_NAME_MAX} required className="inv-input" />
      </label>

      <label className="inv-field" htmlFor={`${id}-description`}>
        <span className="inv-label">Description</span>
        <textarea
          id={`${id}-description`}
          name="description"
          defaultValue={item?.description ?? ""}
          maxLength={ITEM_DESCRIPTION_MAX}
          rows={3}
          className="inv-input"
          onChange={(event) => setDescription(event.target.value)}
        />
        <span className="inv-counter">
          {description.length}/{ITEM_DESCRIPTION_MAX}
        </span>
      </label>

      <div className="inv-grid-2">
        <label className="inv-field" htmlFor={`${id}-category`}>
          <span className="inv-label">Category *</span>
          <select id={`${id}-category`} name="category" defaultValue={item?.category ?? INVENTORY_CATEGORIES[0]} required className="inv-input">
            {item && !(INVENTORY_CATEGORIES as readonly string[]).includes(item.category) && <option value={item.category}>{item.category}</option>}
            {INVENTORY_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="inv-field" htmlFor={`${id}-sku`}>
          <span className="inv-label">SKU</span>
          <input id={`${id}-sku`} name="sku" type="text" defaultValue={item?.sku ?? ""} maxLength={ITEM_SKU_MAX} className="inv-input" />
        </label>
      </div>

      <div className="inv-grid-2">
        <label className="inv-field" htmlFor={`${id}-brand`}>
          <span className="inv-label">Brand</span>
          <input id={`${id}-brand`} name="brand" type="text" defaultValue={item?.brand ?? ""} maxLength={ITEM_BRAND_MAX} className="inv-input" />
        </label>
        <label className="inv-field" htmlFor={`${id}-supplier`}>
          <span className="inv-label">Supplier</span>
          <select id={`${id}-supplier`} name="supplierId" defaultValue={item?.supplierId ?? ""} className="inv-input">
            <option value="">No supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="inv-grid-2">
        <label className="inv-field" htmlFor={`${id}-cost`}>
          <span className="inv-label">Unit Cost</span>
          <input id={`${id}-cost`} name="unitCostDollars" type="number" min="0" step="0.01" defaultValue={dollars(item?.unitCostCents ?? null)} placeholder="0.00" className="inv-input" />
        </label>
        <label className="inv-field" htmlFor={`${id}-price`}>
          <span className="inv-label">Selling Price (Optional)</span>
          <input id={`${id}-price`} name="sellingPriceDollars" type="number" min="0" step="0.01" defaultValue={dollars(item?.sellingPriceCents ?? null)} placeholder="0.00" className="inv-input" />
        </label>
      </div>

      <div className="inv-grid-2">
        {!item && (
          <label className="inv-field" htmlFor={`${id}-stock`}>
            <span className="inv-label">Initial Stock</span>
            <input id={`${id}-stock`} name="initialStock" type="number" min="0" step="1" defaultValue="0" className="inv-input" />
          </label>
        )}
        <label className="inv-field" htmlFor={`${id}-low`}>
          <span className="inv-label">Low Stock Alert</span>
          <input id={`${id}-low`} name="lowStockAt" type="number" min="0" step="1" defaultValue={item?.lowStockAt ?? 5} required className="inv-input" />
          <span className="inv-hint">Counts as low at or below this many.</span>
        </label>
      </div>

      {state.error && (
        <p role="alert" className="inv-error">
          {state.error}
        </p>
      )}
      {!state.error && state.done > 0 && (
        <p role="status" className="inv-saved">
          Saved.
        </p>
      )}

      <div className="inv-actions">
        {cancelHref && (
          <Link href={cancelHref} replace scroll={false} className="admin-btn" data-variant="secondary">
            Cancel
          </Link>
        )}
        <button type="submit" className="admin-btn" disabled={pending}>
          {pending ? "Saving…" : item ? "Save Changes" : "Add Item"}
        </button>
      </div>
    </form>
  );
}
