"use client";

import { useState, useTransition } from "react";
import { createBalanceAction } from "./create-balance-action";

/** "Balance due: $X, Create Balance": records the Balance so it can then be marked received. */
export function CreateBalanceButton({ orderId, amount }: { orderId: string; amount: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createBalanceAction(orderId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="od-balance-action">
      <p className="od-muted">Balance due: {amount}</p>
      <button type="button" className="admin-btn" data-variant="secondary" onClick={create} disabled={pending}>
        {pending ? "Creating…" : "Create Balance"}
      </button>
      {error && (
        <p className="att-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
