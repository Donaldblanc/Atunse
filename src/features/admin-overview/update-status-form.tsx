"use client";

import { useActionState, useState } from "react";
import { ITEM_STATUS_LABELS, type ItemStatus } from "@/features/orders/domain";
import { updateItemStatusAction, type UpdateStatusState } from "./order-actions";

/**
 * Update Status for one pair: offers only where the owner may move it (the
 * next step and Cancel, per adminStatusMoves), submitted to a server action.
 * A step that's held (on the quote or the deposit) says why instead.
 * Cancelling can't be undone, so it takes a second, explicit click.
 */
export function UpdateStatusForm({
  orderId,
  itemId,
  fromStatus,
  nextStatuses,
  held,
  idempotencyKey,
  pairLabel,
}: {
  orderId: string;
  itemId: string;
  fromStatus: ItemStatus;
  nextStatuses: ItemStatus[];
  held: string | null;
  /** Made when the dialog rendered, so a double submit applies once (ADR-0012). */
  idempotencyKey: string;
  /** Names the pair when the Order has several; null for a single pair. */
  pairLabel: string | null;
}) {
  const [state, formAction, pending] = useActionState<UpdateStatusState, FormData>(updateItemStatusAction, { error: null });
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const forward = nextStatuses.find((status) => status !== "CANCELLED");
  const canCancel = nextStatuses.includes("CANCELLED");
  if (!forward && !canCancel && !held) return null;

  return (
    <form action={formAction} className="od-status-form">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="fromStatus" value={fromStatus} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {pairLabel && <p className="od-status-pair">{pairLabel}</p>}
      <div className="od-status-actions">
        {forward && (
          <button type="submit" name="toStatus" value={forward} className="admin-btn" disabled={pending}>
            Move to {ITEM_STATUS_LABELS[forward]}
          </button>
        )}
        {canCancel &&
          (confirmingCancel ? (
            <>
              <button type="submit" name="toStatus" value="CANCELLED" className="admin-btn" data-variant="danger" disabled={pending}>
                Confirm cancel
              </button>
              <button type="button" className="admin-btn" data-variant="secondary" onClick={() => setConfirmingCancel(false)} disabled={pending}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" className="admin-btn" data-variant="secondary" onClick={() => setConfirmingCancel(true)} disabled={pending}>
              Cancel {pairLabel ? "pair" : "order"}
            </button>
          ))}
      </div>
      {held && <p className="od-status-held">{held}</p>}
      {state.error && (
        <p role="alert" className="od-status-error">
          {state.error}
        </p>
      )}
    </form>
  );
}
