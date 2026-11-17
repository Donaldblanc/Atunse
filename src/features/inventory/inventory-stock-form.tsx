"use client";

import { useActionState, useState } from "react";
import { adjustInventoryStockAction } from "./inventory-actions";
import type { InventoryFormState } from "./inventory-form";
import { STOCK_CHANGE_LIMIT, STOCK_NOTE_MAX_LENGTH } from "./use-cases/adjust-stock";

/** The panel's Adjust stock: a change (negative uses stock up), a reason and an optional note. `seenStock` is the figure on screen. */
export function InventoryStockForm({ itemId, seenStock, idempotencyKey }: { itemId: string; seenStock: number; idempotencyKey: string }) {
  const [change, setChange] = useState("");
  const [note, setNote] = useState("");
  const [state, formAction, pending] = useActionState<InventoryFormState, FormData>(async (previous, formData) => {
    const next = await adjustInventoryStockAction(previous, formData);
    if (!next.error) {
      setChange("");
      setNote("");
    }
    return next;
  }, { error: null, done: 0 });

  return (
    <form action={formAction} className="inv-stock-form">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="seenStock" value={seenStock} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label className="inv-field">
        <span className="inv-label">Change</span>
        <input name="change" type="number" step={1} min={-STOCK_CHANGE_LIMIT} max={STOCK_CHANGE_LIMIT} required value={change} onChange={(event) => setChange(event.target.value)} placeholder="±10" className="inv-input" />
      </label>
      <label className="inv-field">
        <span className="inv-label">Reason</span>
        <select name="reason" defaultValue="RESTOCK" className="inv-input">
          <option value="RESTOCK">Restock</option>
          <option value="ADJUSTMENT">Adjustment</option>
        </select>
      </label>
      <label className="inv-field inv-stock-note">
        <span className="inv-label">Note</span>
        <input name="note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={STOCK_NOTE_MAX_LENGTH} placeholder="Optional" className="inv-input" />
      </label>
      <button type="submit" className="admin-btn" disabled={pending || change.trim() === ""}>
        {pending ? "Saving…" : "Adjust stock"}
      </button>
      {state.error && (
        <p role="alert" className="inv-error inv-stock-error">
          {state.error}
        </p>
      )}
    </form>
  );
}
