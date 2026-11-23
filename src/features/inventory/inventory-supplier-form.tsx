"use client";

import { useActionState, useRef } from "react";
import { createSupplierAction } from "./inventory-actions";
import type { InventoryFormState } from "./inventory-form";
import { SUPPLIER_CONTACT_MAX, SUPPLIER_NAME_MAX, SUPPLIER_NOTES_MAX } from "./use-cases/suppliers";

/** The Supplier tab's "Add supplier": new suppliers are created here, then picked from an item's Supplier select. */
export function InventorySupplierForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<InventoryFormState, FormData>(async (previous, formData) => {
    const next = await createSupplierAction(previous, formData);
    if (!next.error) formRef.current?.reset();
    return next;
  }, { error: null, done: 0 });

  return (
    <form action={formAction} ref={formRef} className="inv-form">
      <h3 className="inv-section-title">Add supplier</h3>
      <label className="inv-field">
        <span className="inv-label">Name *</span>
        <input name="name" required maxLength={SUPPLIER_NAME_MAX} className="inv-input" />
      </label>
      <div className="inv-grid-2">
        <label className="inv-field">
          <span className="inv-label">Email</span>
          <input name="email" type="email" maxLength={SUPPLIER_CONTACT_MAX} className="inv-input" />
        </label>
        <label className="inv-field">
          <span className="inv-label">Phone</span>
          <input name="phone" type="tel" maxLength={SUPPLIER_CONTACT_MAX} className="inv-input" />
        </label>
      </div>
      <label className="inv-field">
        <span className="inv-label">Website</span>
        <input name="website" maxLength={SUPPLIER_CONTACT_MAX} className="inv-input" />
      </label>
      <label className="inv-field">
        <span className="inv-label">Notes</span>
        <textarea name="notes" rows={2} maxLength={SUPPLIER_NOTES_MAX} className="inv-input" />
      </label>
      {state.error && (
        <p role="alert" className="inv-error">
          {state.error}
        </p>
      )}
      {!state.error && state.done > 0 && (
        <p role="status" className="inv-saved">
          Supplier added.
        </p>
      )}
      <div className="inv-actions">
        <button type="submit" className="admin-btn" disabled={pending}>
          {pending ? "Adding…" : "Add supplier"}
        </button>
      </div>
    </form>
  );
}
