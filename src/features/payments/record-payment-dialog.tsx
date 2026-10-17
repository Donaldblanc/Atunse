"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/features/orders/domain";
import { recordPaymentAction } from "./record-payment-action";

/**
 * "Record Payment" (header button): logs a payment against an Order outside
 * the Deposit/Balance flow. A native <dialog>, like the rest of the admin's
 * modals, but self-contained (not URL-driven): it isn't a detail view that
 * needs to survive a reload. The key is made once per open, so a dropped
 * response and a retry record it once (ADR-0012).
 */
export function RecordPaymentDialog() {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  function open() {
    setError(null);
    setIdempotencyKey(crypto.randomUUID());
    ref.current?.showModal();
  }

  function close() {
    ref.current?.close();
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await recordPaymentAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className="admin-btn" onClick={open}>
        + Record Payment
      </button>
      <dialog ref={ref} className="admin-dialog" data-size="sm" aria-label="Record Payment" onCancel={() => setError(null)}>
        <div className="admin-dialog-body">
          <div className="admin-dialog-head">
            <h2 className="admin-dialog-title">Record Payment</h2>
            <button type="button" className="admin-dialog-close" aria-label="Close" onClick={close}>
              ×
            </button>
          </div>
          <form className="pm-record-form" onSubmit={onSubmit}>
            <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
            <label htmlFor="pm-order-ref">Order number</label>
            <input id="pm-order-ref" name="orderReference" required placeholder="ATU-1234" className="att-search-input" disabled={pending} />

            <label htmlFor="pm-amount">Amount</label>
            <input id="pm-amount" name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" className="att-search-input" disabled={pending} />

            <label htmlFor="pm-method">Method</label>
            <select id="pm-method" name="method" required className="pm-select" disabled={pending}>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </select>

            <label htmlFor="pm-reference">Reference (optional)</label>
            <input id="pm-reference" name="reference" className="att-search-input" disabled={pending} />

            {error && (
              <p className="att-error" role="alert">
                {error}
              </p>
            )}

            <div className="pm-record-actions">
              <button type="button" className="admin-btn" data-variant="secondary" onClick={close} disabled={pending}>
                Cancel
              </button>
              <button type="submit" className="admin-btn" disabled={pending}>
                {pending ? "Saving…" : "Record Payment"}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
