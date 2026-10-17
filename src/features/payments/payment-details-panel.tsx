// The Payments screen's right-side Payment Details panel (design:
// scratch/payments.jpeg): the clicked row's data, an Order Summary and a
// Payment Timeline, plus Refund Payment and View Order.

import Link from "next/link";
import { PAYMENT_METHOD_LABELS, orderNumber } from "@/features/orders/domain";
import { SERVICE_CATALOG } from "@/features/orders/service-catalog";
import { formatDollars } from "./money-format";
import { RefundPaymentButton } from "./refund-payment-button";
import type { PaymentDetail } from "./repositories/payment-repository";

const STATUS_LABELS: Record<PaymentDetail["status"], string> = { PENDING: "Pending", RECEIVED: "Paid", FAILED: "Failed", REFUNDED: "Refunded" };
const dateTimeFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

function serviceName(id: string): string {
  return SERVICE_CATALOG.find((service) => service.id === id)?.name ?? id;
}

export function PaymentDetailsPanel({ detail, closeHref }: { detail: PaymentDetail; closeHref: string }) {
  return (
    <aside className="pm-panel" aria-label="Payment details">
      <div className="pm-panel-head">
        <h2 className="pm-panel-title">Payment Details</h2>
        <Link href={closeHref} scroll={false} className="pm-panel-close" aria-label="Close">
          ×
        </Link>
      </div>

      <span className="pm-status" data-status={detail.status}>
        {STATUS_LABELS[detail.status]}
      </span>
      <p className="pm-panel-amount">{formatDollars(detail.amount)}</p>
      <p className="pm-panel-order">{orderNumber(detail.orderNumber)}</p>
      <p className="ov-cell-sub">{dateTimeFormat.format(detail.createdAt)}</p>

      <dl className="pm-facts">
        <div>
          <dt>Method</dt>
          <dd>{PAYMENT_METHOD_LABELS[detail.method]}</dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd>{detail.reference ?? "Manual"}</dd>
        </div>
        <div>
          <dt>Customer</dt>
          <dd>{detail.customerName}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{detail.customerEmail}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{detail.customerPhone}</dd>
        </div>
      </dl>

      {detail.items.length > 0 && (
        <section className="pm-panel-section">
          <h3>Order Summary</h3>
          <ul className="pm-order-summary">
            {detail.items.map((item, index) => (
              <li key={index}>
                <span className="pm-order-item">
                  {item.brand} {item.model}
                  {item.colorway ? ` · ${item.colorway}` : ""}
                </span>
                <span>{formatDollars(item.price ?? item.estimate)}</span>
                {item.serviceIds.map((id) => (
                  <span key={id} className="pm-order-service">
                    Service: {serviceName(id)}
                  </span>
                ))}
              </li>
            ))}
          </ul>
          <div className="pm-order-total">
            <span>Total</span>
            <span>{formatDollars(detail.orderTotal)}</span>
          </div>
        </section>
      )}

      <section className="pm-panel-section">
        <h3>Payment Timeline</h3>
        <ol className="pm-timeline">
          {detail.timeline.map((entry, index) => (
            <li key={index}>
              <p className="pm-timeline-label">{entry.label}</p>
              <p className="ov-cell-sub">{dateTimeFormat.format(entry.at)}</p>
              <p className="pm-timeline-detail">{entry.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="pm-panel-actions">
        {detail.status === "RECEIVED" && <RefundPaymentButton paymentId={detail.id} amount={formatDollars(detail.amount)} />}
        <Link href={`/admin/orders/${detail.orderId}`} className="admin-btn">
          View Order →
        </Link>
      </div>
    </aside>
  );
}
