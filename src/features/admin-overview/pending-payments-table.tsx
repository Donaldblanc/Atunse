"use client";

import Link from "next/link";
import { useId, useMemo, useState, useTransition } from "react";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/features/orders/domain";
import { confirmDepositAction } from "./confirm-deposit-action";
import type { PendingPaymentRow } from "./attention-panels";

export type PendingPaymentTableRow = PendingPaymentRow & {
  /** The Order's dialog (`?order=`), from the server so the range params ride along. */
  href: string;
};

type Tab = "ALL" | PaymentMethod;

/**
 * Pending Payments (design: Needs Attention > Pending Payments): the Orders
 * whose Deposit is still waiting, filterable by method and searchable by
 * order number or customer. The list is small, so it's all loaded and
 * filtered here rather than by another round trip.
 */
export function PendingPaymentsTable({ rows }: { rows: PendingPaymentTableRow[] }) {
  const [tab, setTab] = useState<Tab>("ALL");
  const [query, setQuery] = useState("");
  const searchId = useId();

  // Only the methods with a Deposit waiting get a tab.
  const methods = PAYMENT_METHODS.filter((method) => rows.some((row) => row.method === method));
  const activeTab = tab === "ALL" || methods.includes(tab) ? tab : "ALL"; // the last row of a method was just marked paid

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (activeTab === "ALL" || row.method === activeTab) &&
        (needle === "" || row.reference.toLowerCase().includes(needle) || row.customerName.toLowerCase().includes(needle)),
    );
  }, [rows, activeTab, query]);

  if (rows.length === 0) return <p className="ov-empty">Every deposit is confirmed.</p>;

  return (
    <div className="att">
      <div className="att-toolbar">
        <div className="att-tabs" role="tablist" aria-label="Payment method">
          <TabButton selected={activeTab === "ALL"} onSelect={() => setTab("ALL")}>
            All ({rows.length})
          </TabButton>
          {methods.map((method) => (
            <TabButton key={method} selected={activeTab === method} onSelect={() => setTab(method)}>
              {PAYMENT_METHOD_LABELS[method]} ({rows.filter((row) => row.method === method).length})
            </TabButton>
          ))}
        </div>
        <div className="att-search">
          <label htmlFor={searchId} className="att-search-label">
            Search orders
          </label>
          <input
            id={searchId}
            type="search"
            className="att-search-input"
            placeholder="Search by order # or customer"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="ov-empty">No matching orders.</p>
      ) : (
        <div className="att-scroll" role="tabpanel">
          <table className="ov-table att-table">
            <thead>
              <tr>
                <th scope="col">Order #</th>
                <th scope="col">Customer</th>
                <th scope="col">Amount</th>
                <th scope="col">Method</th>
                <th scope="col">Order Date</th>
                <th scope="col" className="ov-num">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.orderId}>
                  <td className="ov-ref">
                    <Link className="att-link" href={row.href} scroll={false}>
                      {row.reference}
                    </Link>
                  </td>
                  <td>
                    <span className="ov-cell-main">{row.customerName}</span>
                  </td>
                  <td className="ov-total">{row.amount}</td>
                  <td>{row.methodLabel}</td>
                  <td>{row.bookedOn}</td>
                  <td className="ov-num">
                    <MarkPaid orderId={row.orderId} amount={row.amount} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TabButton({ selected, onSelect, children }: { selected: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={selected} className="att-tab" onClick={onSelect}>
      {children}
    </button>
  );
}

/**
 * Marking a Deposit received is money, so the first click only asks; the
 * second, "Confirm $120 received", does it. The key is made once per row,
 * so a double click or a retry after a dropped response settles it once
 * (ADR-0012). When it succeeds the page refreshes and the row is gone.
 */
function MarkPaid({ orderId, amount }: { orderId: string; amount: string }) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmDepositAction(orderId, idempotencyKey);
      if (!result.ok) setError(result.error);
    });
  }

  if (!asking) {
    return (
      <button type="button" className="admin-btn att-action" data-variant="secondary" onClick={() => setAsking(true)}>
        Mark Paid
      </button>
    );
  }
  return (
    <span className="att-confirm">
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
