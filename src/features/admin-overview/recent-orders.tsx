import Link from "next/link";
import { ITEM_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/features/orders/domain";
import type { ItemStatus } from "@/features/orders/domain";
import { bookedDay, type RecentOrder } from "./get-admin-overview";
import { overviewHref, type OverviewSelection } from "./overview-range";
import { PairThumb } from "./pair-thumb";
import { RecentOrderMenu } from "./recent-order-menu";
import { STATUS_TONE } from "./status-tone";

/**
 * The latest bookings (design: Recent Orders). Each row opens its Order's
 * detail dialog through the reference, a real link stretched over the row
 * (so it works without JavaScript and can be opened in a new tab). The "..."
 * menu opens it too, and can mark a pending Deposit or Balance paid or cancel the Order.
 */
export function RecentOrders({ orders, selection }: { orders: RecentOrder[]; selection: OverviewSelection }) {
  if (orders.length === 0) return <p className="ov-empty">No bookings yet.</p>;

  return (
    <div className="ov-table-scroll">
      <table className="ov-table">
        <thead>
          <tr>
            <th scope="col">Order #</th>
            <th scope="col">Customer</th>
            <th scope="col">Items</th>
            <th scope="col">Service</th>
            <th scope="col">Status</th>
            <th scope="col">Payment</th>
            <th scope="col" className="ov-num">
              Total
            </th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.orderId} className="ov-row-link">
              <td className="ov-ref">
                <Link href={overviewHref(selection, { order: order.orderId })} scroll={false} aria-label={`Order ${order.reference}, ${order.customerName}`}>
                  {order.reference}
                </Link>
              </td>
              <td>
                <span className="ov-cell-main">{order.customerName}</span>
                <span className="ov-cell-sub">{bookedDay.format(order.bookedAt)}</span>
              </td>
              <td>
                <span className="ov-items">
                  <PairThumb photo={order.photo} className="ov-thumb" iconSize={22} />
                  <span>
                    <span className="ov-cell-main">{order.pairCount === 1 ? "1 item" : `${order.pairCount} items`}</span>
                    {order.firstPair && <span className="ov-cell-sub">{order.firstPair}</span>}
                  </span>
                </span>
              </td>
              <td>{order.services && <span className="ov-chip-service">{order.services}</span>}</td>
              <td>
                <span className="ov-pill" data-tone={STATUS_TONE[order.status]}>
                  {ITEM_STATUS_LABELS[order.status]}
                </span>
              </td>
              <td>
                <DepositCell deposit={order.deposit} orderStatus={order.status} />
              </td>
              <td className="ov-num ov-total">
                {order.total.format()}
                {order.totalIsMinimum ? "+" : ""}
              </td>
              <td className="ro-actions-cell">
                <RecentOrderMenu
                  orderId={order.orderId}
                  reference={order.reference}
                  openHref={overviewHref(selection, { order: order.orderId })}
                  pendingPayment={order.pendingPayment}
                  canCancel={order.status !== "CANCELLED" && order.status !== "COMPLETED"}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** An Order row's Deposit column (Recent Orders, All orders). */
export function DepositCell({ deposit, orderStatus }: { deposit: RecentOrder["deposit"]; orderStatus: ItemStatus }) {
  if (deposit === null) return null;
  if (deposit.status === "RECEIVED") {
    return (
      <span className="ov-pill" data-tone="green" data-nowrap="true">
        Deposit paid
      </span>
    );
  }
  if (deposit.status === "REFUNDED") {
    return (
      <span className="ov-pill" data-tone="muted" data-nowrap="true">
        Deposit refunded
      </span>
    );
  }
  // A cancelled Order's unpaid deposit isn't owed, so it isn't chased (nor counted in Pending Payments).
  if (deposit.status === "PENDING" && orderStatus === "CANCELLED") return <span className="ov-cell-sub">No deposit due</span>;
  return (
    <>
      <span className="ov-cell-main">{PAYMENT_METHOD_LABELS[deposit.method]}</span>
      {deposit.status === "FAILED" ? <span className="ov-failed">Failed</span> : <span className="ov-pending">Pending</span>}
    </>
  );
}
