import { SneakerIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ITEM_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/features/orders/domain";
import type { RecentOrder } from "./get-admin-overview";
import { overviewHref, type OverviewSelection } from "./overview-range";
import { STATUS_TONE } from "./status-tone";

const bookedDay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "America/New_York",
});

/**
 * The latest bookings (design: Recent Orders). Each row opens its Order's
 * detail dialog through the reference, a real link stretched over the row
 * (so it works without JavaScript and can be opened in a new tab). The
 * design's per-row actions menu has no actions to offer yet (docs/TODO.md).
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
                  {order.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a short-lived storage link, not a static asset next/image can optimize
                    <img src={order.photoUrl} alt="" className="ov-thumb" />
                  ) : (
                    <span className="ov-thumb" aria-hidden="true">
                      <SneakerIcon size={22} />
                    </span>
                  )}
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
                {order.deposit === null ? null : order.deposit.status === "RECEIVED" ? (
                  <span className="ov-pill" data-tone="green" data-nowrap="true">
                    Deposit paid
                  </span>
                ) : order.deposit.status === "REFUNDED" ? (
                  <span className="ov-pill" data-tone="muted" data-nowrap="true">
                    Deposit refunded
                  </span>
                ) : order.deposit.status === "FAILED" ? (
                  <>
                    <span className="ov-cell-main">{PAYMENT_METHOD_LABELS[order.deposit.method]}</span>
                    <span className="ov-failed">Failed</span>
                  </>
                ) : order.status === "CANCELLED" ? (
                  // A cancelled Order's unpaid deposit isn't owed, so it isn't chased (nor counted in Pending Payments).
                  <span className="ov-cell-sub">No deposit due</span>
                ) : (
                  <>
                    <span className="ov-cell-main">{PAYMENT_METHOD_LABELS[order.deposit.method]}</span>
                    <span className="ov-pending">Pending</span>
                  </>
                )}
              </td>
              <td className="ov-num ov-total">
                {order.total.format()}
                {order.totalIsMinimum ? "+" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
