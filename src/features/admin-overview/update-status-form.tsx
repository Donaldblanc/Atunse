"use client";

import { useActionState, useState } from "react";
import { ITEM_STATUS_LABELS, type ItemStatus } from "@/features/orders/domain";
import { updateItemStatusAction, type UpdateStatusState } from "./order-actions";

/**
 * Update Status for one pair: a dropdown of every status the owner may move
 * it to (adminStatusMoves: forward, back or skipping steps), submitted to a
 * server action. Cancel is its own button: it can't be undone, so it takes a
 * second, explicit click.
 */
export function UpdateStatusForm({
  itemId,
  fromStatus,
  nextStatuses,
  held,
  idempotencyKey,
  pairLabel,
}: {
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
  const choices: ItemStatus[] = nextStatuses.filter((status) => status !== "CANCELLED");
  const [chosen, setChosen] = useState<ItemStatus | "">("");
  const selected = choices.includes(chosen as ItemStatus) ? (chosen as ItemStatus) : "";
  const canCancel = nextStatuses.includes("CANCELLED");
  if (choices.length === 0 && !canCancel && !held) return null;

  return (
    <form action={formAction} className="od-status-form">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="fromStatus" value={fromStatus} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {pairLabel && <p className="od-status-pair">{pairLabel}</p>}
      <div className="od-status-actions">
        {choices.length > 0 && (
          <>
            <select
              aria-label={pairLabel ? `Status for ${pairLabel}` : "New status"}
              className="od-status-select"
              value={selected}
              onChange={(event) => setChosen(event.target.value as ItemStatus)}
              disabled={pending}
            >
              <option value="" disabled>
                Move to...
              </option>
              {choices.map((status) => (
                <option key={status} value={status}>
                  {ITEM_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <button type="submit" name="toStatus" value={selected} className="admin-btn" disabled={pending || !selected}>
              Update status
            </button>
          </>
        )}
        {canCancel &&
          (confirmingCancel ? (
            <>
              {/* Keyed apart from "Cancel order": reused in place, the click that swaps them would also submit. */}
              <button key="confirm-cancel" type="submit" name="toStatus" value="CANCELLED" className="admin-btn" data-variant="danger" disabled={pending}>
                Confirm cancel
              </button>
              <button type="button" className="admin-btn" data-variant="secondary" onClick={() => setConfirmingCancel(false)} disabled={pending}>
                Keep
              </button>
            </>
          ) : (
            <button key="ask-cancel" type="button" className="admin-btn" data-variant="secondary" onClick={() => setConfirmingCancel(true)} disabled={pending}>
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
