import Link from "next/link";
import { calendarDateToUtcMidnight } from "@/features/orders/calendar-date";
import { ITEM_STATUS_LABELS } from "@/features/orders/domain";
import type { OrderDetail } from "@/features/admin-overview/order-detail";
import type { CustomerDetail } from "@/features/admin-customers/customer-detail";
import { STATUS_TONE } from "@/features/admin-overview/status-tone";
import { PairThumb } from "@/features/admin-overview/pair-thumb";

const calendarDay = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const bookedDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** The Messages screen's right column: the open thread's Order (when it has one) and its Customer. */
export function ContextPanel({ order, customer }: { order: OrderDetail | null; customer: CustomerDetail }) {
  return (
    <div className="am-context">
      {order && (
        <div className="ov-card">
          <div className="ov-card-head">
            <h2 className="ov-card-title">Order {order.reference}</h2>
            <Link href={`/admin/orders/${order.orderId}`} className="att-link">
              View Order →
            </Link>
          </div>
          <span className="ov-pill" data-tone={STATUS_TONE[order.status]}>
            {ITEM_STATUS_LABELS[order.status]}
          </span>

          <dl className="am-order-facts">
            <dt>{order.customer.fulfillment}</dt>
            <dd>
              {order.customer.schedule ? (
                <>
                  {calendarDay.format(calendarDateToUtcMidnight(order.customer.schedule.date))}
                  {order.customer.schedule.slot ? ` (${order.customer.schedule.slot})` : ""}
                </>
              ) : (
                "Not scheduled yet"
              )}
            </dd>
            {order.customer.address.length > 0 && (
              <>
                <dt>Location</dt>
                <dd>{order.customer.address.join(", ")}</dd>
              </>
            )}
          </dl>

          <ul className="am-pairs">
            {order.pairs.map((pair) => (
              <li key={pair.itemId} className="am-pair">
                <PairThumb photo={pair.photo} className="am-pair-thumb" iconSize={20} />
                <span className="am-pair-body">
                  <span className="am-pair-title">{pair.title ?? "Pair"}</span>
                  <span className="am-pair-sub">{pair.services.map((s) => s.name).join(", ") || "—"}</span>
                </span>
                <span className="am-pair-price">{(pair.price ?? pair.estimate).format()}</span>
              </li>
            ))}
          </ul>

          <div className="am-order-total">
            <span>Total</span>
            <span>{(order.bundlePrice ?? order.payment.quoted?.total ?? order.payment.estimate).format()}</span>
          </div>

          <Link href={`/admin/orders/${order.orderId}`} className="admin-btn am-full-width">
            Edit Order
          </Link>
        </div>
      )}

      <div className="ov-card">
        <div className="ov-card-head">
          <h2 className="ov-card-title">Customer Information</h2>
          <Link href={`/admin/customers/${customer.id}`} className="att-link">
            Edit
          </Link>
        </div>
        <dl className="am-customer-facts">
          <dt className="sr-only">Name</dt>
          <dd>{customer.name ?? customer.email}</dd>
          <dt className="sr-only">Email</dt>
          <dd>{customer.email}</dd>
          {customer.phone && (
            <>
              <dt className="sr-only">Phone</dt>
              <dd>{customer.phone}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="ov-card">
        <div className="ov-card-head">
          <h2 className="ov-card-title">Recent Orders</h2>
          <Link href={`/admin/customers/${customer.id}`} className="att-link">
            View All →
          </Link>
        </div>
        {customer.orders.length === 0 ? (
          <p className="ov-empty">No orders yet.</p>
        ) : (
          <ul className="am-recent-orders">
            {customer.orders.slice(0, 3).map((row) => (
              <li key={row.orderId}>
                <Link href={`/admin/orders/${row.orderId}`} className="am-recent-order">
                  <span className="am-recent-order-ref">{row.reference}</span>
                  <span className="am-recent-order-meta">
                    <span className="ov-cell-sub">{bookedDay.format(row.createdAt)}</span>
                    <span className="ov-pill" data-tone={STATUS_TONE[row.status]}>
                      {ITEM_STATUS_LABELS[row.status]}
                    </span>
                  </span>
                  <span className="am-recent-order-price">{row.estimate.format()}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
