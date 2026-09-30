import { SneakerIcon } from "@phosphor-icons/react/dist/ssr";
import { ITEM_STATUS_LABELS, type ItemStatus } from "@/features/orders/domain";
import type { RecentOrder } from "./get-admin-overview";

const bookedDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

/** Status pill colours: where the pair is in the pipeline, always with its label. */
const STATUS_TONE: Record<ItemStatus, string> = {
  REQUEST_SUBMITTED: "neutral",
  UNDER_REVIEW: "neutral",
  QUOTE_SENT: "amber",
  APPROVED: "amber",
  AWAITING_SNEAKERS: "amber",
  IN_PROGRESS: "blue",
  QUALITY_CHECK: "blue",
  READY_FOR_PICKUP_SHIPPING: "violet",
  COMPLETED: "green",
  CANCELLED: "muted",
};

/**
 * The latest bookings (design: Recent Orders). The design's per-row
 * actions menu arrives with Order detail, which it would open.
 */
export function RecentOrders({ orders }: { orders: RecentOrder[] }) {
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
            <tr key={order.orderId}>
              <td className="ov-ref">{order.reference}</td>
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
                {order.depositPaid ? (
                  <span className="ov-pill" data-tone="green" data-nowrap="true">
                    Deposit paid
                  </span>
                ) : order.status === "CANCELLED" ? (
                  // A cancelled Order's unpaid deposit isn't owed, so it isn't chased (nor counted in Pending Payments).
                  <span className="ov-cell-sub">No deposit due</span>
                ) : (
                  <>
                    <span className="ov-cell-main">Deposit</span>
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
