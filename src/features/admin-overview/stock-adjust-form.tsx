"use client";

import { useActionState, useState } from "react";
import { STOCK_CHANGE_LIMIT, STOCK_NOTE_MAX_LENGTH } from "@/features/inventory/use-cases/adjust-stock";
import { adjustStockAction, type AdjustStockState } from "./stock-actions";
import "@/styles/overview-stock-reviews.css";

/** One Low Stock row's Adjust stock: a change (negative uses stock up), a reason and an optional note. */
export function StockAdjustForm({ itemId, seenStock, idempotencyKey }: { itemId: string; seenStock: number; idempotencyKey: string }) {
  const [change, setChange] = useState("");
  const [note, setNote] = useState("");
  const [state, formAction, pending] = useActionState<AdjustStockState, FormData>(async (previous, formData) => {
    const next = await adjustStockAction(previous, formData);
    if (!next.error) {
      setChange("");
      setNote("");
    }
    return next;
  }, { error: null, done: 0 });

  return (
    <form action={formAction} className="stk-form">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="seenStock" value={seenStock} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label className="stk-field">
        <span className="stk-label">Change</span>
        <input
          name="change"
          type="number"
          step={1}
          min={-STOCK_CHANGE_LIMIT}
          max={STOCK_CHANGE_LIMIT}
          required
          value={change}
          onChange={(event) => setChange(event.target.value)}
          placeholder="±10"
          className="oe-input"
        />
      </label>
      <label className="stk-field">
        <span className="stk-label">Reason</span>
        <select name="reason" defaultValue="RESTOCK" className="oe-input">
          <option value="RESTOCK">Restock</option>
          <option value="ADJUSTMENT">Adjustment</option>
        </select>
      </label>
      <label className="stk-field stk-note">
        <span className="stk-label">Note</span>
        <input name="note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={STOCK_NOTE_MAX_LENGTH} placeholder="Optional" className="oe-input" />
      </label>
      <button type="submit" className="admin-btn" disabled={pending || change.trim() === ""}>
        {pending ? "Saving…" : "Adjust stock"}
      </button>
      {state.error && (
        <p role="alert" className="od-status-error stk-error">
          {state.error}
        </p>
      )}
    </form>
  );
}
