import Link from "next/link";
import { ITEM_STATUS_LABELS } from "@/features/orders/domain";
import { bookedDay } from "./get-admin-overview";
import { DepositCell } from "./recent-orders";
import type { OrderListRow } from "./search-orders";
import { STATUS_TONE } from "./status-tone";

/**
 * The orders table shared by the Overview's "All orders" dialog and the
 * standalone `/admin/orders` page: same columns, same empty state. Only how
 * a row links (dialog vs. page route) and whether links scroll differ, so
 * the caller supplies `rowHref`.
 */
export function OrdersTable({ rows, rowHref, scroll = true }: { rows: OrderListRow[]; rowHref: (row: OrderListRow) => string; scroll?: boolean }) {
  if (rows.length === 0) {
    return <p className="ov-empty">No orders match.</p>;
  }
  return (
    <div className="att-scroll">
      <table className="ov-table att-table">
        <thead>
          <tr>
            <th scope="col">Order #</th>
            <th scope="col">Customer</th>
            <th scope="col">Items</th>
            <th scope="col">Service</th>
            <th scope="col">Status</th>
            <th scope="col">Deposit</th>
            <th scope="col" className="ov-num">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.orderId} className="ov-row-link">
              <td className="ov-ref">
                <Link href={rowHref(row)} scroll={scroll} aria-label={`Order ${row.reference}, ${row.customerName}`}>
                  {row.reference}
                </Link>
              </td>
              <td>
                <span className="ov-cell-main">{row.customerName}</span>
                <span className="ov-cell-sub">{bookedDay.format(row.bookedAt)}</span>
              </td>
              <td>{row.pairCount === 1 ? "1 item" : `${row.pairCount} items`}</td>
              <td>{row.services && <span className="ov-chip-service">{row.services}</span>}</td>
              <td>
                <span className="ov-pill" data-tone={STATUS_TONE[row.status]}>
                  {ITEM_STATUS_LABELS[row.status]}
                </span>
              </td>
              <td>
                <DepositCell deposit={row.deposit} orderStatus={row.status} />
              </td>
              <td className="ov-num ov-total">
                {row.total.format()}
                {row.totalIsMinimum ? "+" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
