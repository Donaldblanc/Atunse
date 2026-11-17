"use client";

import { useActionState, useState } from "react";
import { setInventoryItemActiveAction } from "./inventory-actions";
import type { InventoryFormState } from "./inventory-form";

/**
 * Deactivate (the design's "Delete Item": items are never deleted, since Stock History
 * names them) with a confirm step, or Reactivate straight away. The confirm renders
 * different elements from the button that opened it, so one click never submits too.
 */
export function InventoryActiveButton({ itemId, itemName, active, returnTo }: { itemId: string; itemName: string; active: boolean; returnTo: string }) {
  const [state, formAction, pending] = useActionState<InventoryFormState, FormData>(setInventoryItemActiveAction, { error: null, done: 0 });
  const [confirming, setConfirming] = useState(false);

  const hidden = (nextActive: boolean) => (
    <>
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="active" value={String(nextActive)} />
      <input type="hidden" name="returnTo" value={returnTo} />
    </>
  );

  if (!active) {
    return (
      <form action={formAction} className="inv-active">
        {hidden(true)}
        {state.error && (
          <p role="alert" className="inv-error">
            {state.error}
          </p>
        )}
        <button type="submit" className="admin-btn" data-variant="secondary" disabled={pending}>
          {pending ? "Reactivating…" : "Reactivate Item"}
        </button>
      </form>
    );
  }

  if (!confirming) {
    return (
      <div className="inv-active">
        <button type="button" className="admin-btn inv-btn-danger" onClick={() => setConfirming(true)}>
          Deactivate Item
        </button>
      </div>
    );
  }

  return (
    <div className="inv-confirm" role="alertdialog" aria-label="Confirm deactivate item">
      <p>
        <strong>Deactivate {itemName}?</strong> It leaves the stock counts and the Overview&apos;s Low Stock list. Its Stock History is kept, and it can be reactivated later.
      </p>
      {state.error && (
        <p role="alert" className="inv-error">
          {state.error}
        </p>
      )}
      <div className="inv-actions">
        <button type="button" className="admin-btn" data-variant="secondary" onClick={() => setConfirming(false)}>
          Cancel
        </button>
        <form action={formAction}>
          {hidden(false)}
          <button type="submit" className="admin-btn inv-btn-danger" disabled={pending}>
            {pending ? "Deactivating…" : "Deactivate"}
          </button>
        </form>
      </div>
    </div>
  );
}
