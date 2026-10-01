"use client";

import { useActionState, useState } from "react";
import { NOTE_MAX_LENGTH } from "@/features/orders/use-cases/add-order-note";
import { addOrderNoteAction, type AddNoteState } from "./order-edit-actions";

/**
 * Order detail's Add note: a textarea and a button. Notes are the shop's own
 * (admin-only) and can't be edited or removed from here yet. The text is
 * controlled so a failed add keeps what was typed (React resets uncontrolled
 * fields after a form action) and a successful one clears it.
 */
export function OrderNoteForm({ orderId }: { orderId: string }) {
  const [body, setBody] = useState("");
  const [state, formAction, pending] = useActionState<AddNoteState, FormData>(async (previous, formData) => {
    const next = await addOrderNoteAction(previous, formData);
    if (!next.error) setBody("");
    return next;
  }, { error: null, added: 0 });

  return (
    <form action={formAction} className="oe-note-form">
      <input type="hidden" name="orderId" value={orderId} />
      <label htmlFor="oe-note-body" className="oe-label">
        Add a note
      </label>
      <textarea
        id="oe-note-body"
        name="body"
        rows={3}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={NOTE_MAX_LENGTH}
        placeholder="Only you can see notes."
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "oe-note-error" : undefined}
        className="oe-input"
      />
      {state.error && (
        <p id="oe-note-error" role="alert" className="od-status-error">
          {state.error}
        </p>
      )}
      <button type="submit" className="admin-btn" disabled={pending || body.trim() === ""}>
        {pending ? "Adding…" : "Add note"}
      </button>
    </form>
  );
}
