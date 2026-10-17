"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { refundPaymentAction } from "./refund-payment-action";

/**
 * "Refund Payment" (Payment Details panel): money, so the first click only
 * asks for a reason; the second does it. The key is made once per ask, so
 * a double click or a retry refunds it once (ADR-0012).
 */
export function RefundPaymentButton({ paymentId, amount }: { paymentId: string; amount: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await refundPaymentAction(paymentId, reason, idempotencyKey);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  if (!asking) {
    return (
      <button type="button" className="admin-btn" data-variant="secondary" onClick={() => setAsking(true)}>
        Refund Payment
      </button>
    );
  }
  return (
    <div className="pm-refund-confirm">
      <label className="sr-only" htmlFor="pm-refund-reason">
        Reason (optional)
      </label>
      <input id="pm-refund-reason" className="att-search-input" placeholder="Reason (optional)" value={reason} onChange={(event) => setReason(event.target.value)} disabled={pending} />
      <div className="pm-refund-confirm-actions">
        <button type="button" className="admin-btn" onClick={confirm} disabled={pending}>
          {pending ? "Refunding…" : `Confirm ${amount} refund`}
        </button>
        <button type="button" className="admin-btn" data-variant="secondary" onClick={() => setAsking(false)} disabled={pending}>
          Cancel
        </button>
      </div>
      {error && (
        <p className="att-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
