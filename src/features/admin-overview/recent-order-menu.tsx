"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { usePopover } from "@/shared/ui/use-popover";
import { cancelOrderAction } from "./cancel-order-action";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/features/orders/domain";
import { confirmPaymentAction } from "./confirm-payment-action";
import "./find-orders.css";

type Asking = "paid" | "cancel" | null;

/**
 * The "..." menu on a Recent Orders row: Open order, Mark Paid (a Deposit is
 * waiting; confirmed as booked, by its own method: Pending Payments is where
 * the owner picks another, or settles a Balance) and Cancel order. Mark Paid and Cancel are money or customer
 * emails, so the first click only asks; the confirm button is a different
 * element (keyed apart), or the click that swaps them would also submit.
 * Each key is made once per row, so a double click settles once (ADR-0012).
 */
export function RecentOrderMenu({
  orderId,
  reference,
  openHref,
  pendingDeposit,
  canCancel,
}: {
  orderId: string;
  reference: string;
  openHref: string;
  /** The Deposit waiting on the owner, or null when none is. */
  pendingDeposit: { paymentId: string; method: PaymentMethod } | null;
  canCancel: boolean;
}) {
  const { open, setOpen, toggle, rootRef } = usePopover<HTMLDivElement>();
  const panelId = useId();
  const [asking, setAsking] = useState<Asking>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [paidKey] = useState(() => crypto.randomUUID());
  const [cancelKey] = useState(() => crypto.randomUUID());

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setAsking(null);
        setOpen(false);
      } else setError(result.error);
    });
  }

  return (
    <div className="ro-menu" ref={rootRef}>
      <button
        type="button"
        className="ro-menu-button"
        aria-label={`Actions for order ${reference}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setAsking(null);
          setError(null);
          toggle();
        }}
      >
        <span aria-hidden="true">…</span>
      </button>
      {open && (
        <div className="ro-menu-panel" id={panelId}>
          <Link className="ro-menu-item" href={openHref} scroll={false}>
            Open order
          </Link>
          {pendingDeposit &&
            (asking === "paid" ? (
              <button
                key="confirm-paid"
                type="button"
                className="ro-menu-item"
                onClick={() => run(() => confirmPaymentAction(pendingDeposit.paymentId, pendingDeposit.method, paidKey))}
                disabled={pending}
              >
                {pending ? "Saving…" : `Confirm ${PAYMENT_METHOD_LABELS[pendingDeposit.method]} deposit received`}
              </button>
            ) : (
              <button key="ask-paid" type="button" className="ro-menu-item" onClick={() => setAsking("paid")} disabled={pending}>
                Mark Paid
              </button>
            ))}
          {canCancel &&
            (asking === "cancel" ? (
              <button key="confirm-cancel" type="button" className="ro-menu-item" data-tone="danger" onClick={() => run(() => cancelOrderAction(orderId, cancelKey))} disabled={pending}>
                {pending ? "Cancelling…" : "Confirm cancel order"}
              </button>
            ) : (
              <button key="ask-cancel" type="button" className="ro-menu-item" data-tone="danger" onClick={() => setAsking("cancel")} disabled={pending}>
                Cancel order
              </button>
            ))}
          {error && (
            <p className="ro-menu-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
