// The Payments screen's table (design: scratch/payments.jpeg). Each row
// links to its own Payment Details panel via `?payment=`.

import Link from "next/link";
import { PAYMENT_METHOD_LABELS } from "@/features/orders/domain";
import { orderNumber } from "@/features/orders/domain";
import { formatDollars } from "./money-format";
import type { PaymentRow } from "./repositories/payment-repository";

const STATUS_LABELS: Record<PaymentRow["status"], string> = { PENDING: "Pending", RECEIVED: "Paid", FAILED: "Failed", REFUNDED: "Refunded" };

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function PaymentsTable({ rows, buildDetailHref, selectedId }: { rows: PaymentRow[]; buildDetailHref: (id: string) => string; selectedId: string | null }) {
  if (rows.length === 0) return <p className="ov-empty">No payments match these filters.</p>;

  return (
    <div className="att-scroll">
      <table className="ov-table pm-table">
        <thead>
          <tr>
            <th scope="col" className="pm-check">
              <span className="sr-only">Select</span>
            </th>
            <th scope="col">Date</th>
            <th scope="col">Order #</th>
            <th scope="col">Customer</th>
            <th scope="col">Amount</th>
            <th scope="col">Payment Method</th>
            <th scope="col">Status</th>
            <th scope="col">Reference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="ov-row-link" aria-current={row.id === selectedId ? "true" : undefined}>
              <td className="pm-check">
                <input type="checkbox" aria-label={`Select payment ${orderNumber(row.orderNumber)}`} />
              </td>
              <td>
                {dateFormat.format(row.createdAt)}
                <br />
                <span className="ov-cell-sub">{timeFormat.format(row.createdAt)}</span>
              </td>
              <td className="ov-ref">
                <Link className="att-link" href={buildDetailHref(row.id)} scroll={false}>
                  {orderNumber(row.orderNumber)}
                </Link>
              </td>
              <td>{row.customerName}</td>
              <td className="ov-total">{formatDollars(row.amount)}</td>
              <td>{PAYMENT_METHOD_LABELS[row.method]}</td>
              <td>
                <span className="pm-status" data-status={row.status}>
                  {STATUS_LABELS[row.status]}
                </span>
              </td>
              <td className="ov-cell-sub">{row.reference ?? "Manual"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
