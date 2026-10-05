"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { MarkReceived } from "./mark-received";
import type { PendingPaymentRow } from "./attention-panels";

export type PendingPaymentTableRow = PendingPaymentRow & {
  /** The Order's dialog (`?order=`), from the server so the range params ride along. */
  href: string;
};

type Tab = "ALL" | PendingPaymentRow["kind"];

const KIND_LABELS: Record<PendingPaymentRow["kind"], string> = { DEPOSIT: "Deposit", BALANCE: "Balance" };


/**
 * Pending Payments (design: Needs Attention > Pending Payments): the
 * Deposits and Balances still waiting, with a tab for each and a search by
 * order number or customer. The list is small, so it's all loaded and
 * filtered here rather than by another round trip.
 */
export function PendingPaymentsTable({ rows }: { rows: PendingPaymentTableRow[] }) {
  const [tab, setTab] = useState<Tab>("ALL");
  const [query, setQuery] = useState("");
  const searchId = useId();

  // Only the kinds with a payment waiting get a tab.
  const kinds = (Object.keys(KIND_LABELS) as PendingPaymentRow["kind"][]).filter((kind) => rows.some((row) => row.kind === kind));
  const activeTab = tab === "ALL" || kinds.includes(tab) ? tab : "ALL"; // the last row of a kind was just marked received

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (activeTab === "ALL" || row.kind === activeTab) &&
        (needle === "" || row.reference.toLowerCase().includes(needle) || row.customerName.toLowerCase().includes(needle)),
    );
  }, [rows, activeTab, query]);

  if (rows.length === 0) return <p className="ov-empty">Every payment is confirmed.</p>;

  return (
    <div className="att">
      <div className="att-toolbar">
        <div className="att-tabs" role="tablist" aria-label="Payment type">
          <TabButton selected={activeTab === "ALL"} onSelect={() => setTab("ALL")}>
            All ({rows.length})
          </TabButton>
          {kinds.map((kind) => (
            <TabButton key={kind} selected={activeTab === kind} onSelect={() => setTab(kind)}>
              {KIND_LABELS[kind]} ({rows.filter((row) => row.kind === kind).length})
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
          <table className="ov-table att-table" data-kind="payments">
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
                <tr key={row.paymentId} className="ov-row-link">
                  <td className="ov-ref">
                    <Link className="att-link" href={row.href} scroll={false}>
                      {row.reference}
                    </Link>
                  </td>
                  <td>
                    <span className="ov-cell-main">{row.customerName}</span>
                  </td>
                  <td className="ov-total">{row.amount}</td>
                  <td>
                    {row.methodLabel} · {KIND_LABELS[row.kind]}
                  </td>
                  <td>{row.bookedOn}</td>
                  <td className="ov-num">
                    <MarkReceived paymentId={row.paymentId} amount={row.amount} method={row.method} label="Mark Paid" />
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
