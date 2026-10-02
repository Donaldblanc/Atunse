"use client";

import { useState, useTransition } from "react";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/features/orders/domain";
import "@/styles/admin-payments.css";
import { confirmPaymentAction } from "./confirm-payment-action";

/** Zelle and Cash are the methods the owner confirms by hand (ADR-0002). */
const MANUAL_METHODS: PaymentMethod[] = ["ZELLE", "CASH"];

/**
 * Marking a payment received is money, so the first click only asks; the
 * second, "Confirm $120 received", does it. The owner can change the method
 * it arrived by (Zelle or Cash) first. The key is made once per row, so a
 * double click or a retry after a dropped response settles it once
 * (ADR-0012). When it succeeds the page refreshes and the row is gone.
 */
export function MarkReceived({ paymentId, amount, method, label }: { paymentId: string; amount: string; method: PaymentMethod; label: string }) {
  const [asking, setAsking] = useState(false);
  const [chosen, setChosen] = useState<PaymentMethod>(method);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmPaymentAction(paymentId, chosen, idempotencyKey);
      if (!result.ok) setError(result.error);
    });
  }

  if (!asking) {
    return (
      <button type="button" className="admin-btn att-action" data-variant="secondary" onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="att-confirm">
      <select className="att-method" aria-label="Received by" value={chosen} onChange={(event) => setChosen(event.target.value as PaymentMethod)} disabled={pending}>
        {MANUAL_METHODS.map((option) => (
          <option key={option} value={option}>
            {PAYMENT_METHOD_LABELS[option]}
          </option>
        ))}
      </select>
      <button type="button" className="admin-btn att-action" onClick={confirm} disabled={pending}>
        {pending ? "Saving…" : `Confirm ${amount} received`}
      </button>
      <button type="button" className="admin-btn att-action" data-variant="secondary" onClick={() => setAsking(false)} disabled={pending}>
        Cancel
      </button>
      {error && (
        <span className="att-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
