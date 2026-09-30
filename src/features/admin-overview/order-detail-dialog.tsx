import { CheckIcon, EnvelopeSimpleIcon, PackageIcon, PhoneIcon, SneakerIcon } from "@phosphor-icons/react/dist/ssr";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { calendarDateToUtcMidnight, SHOP_TIMEZONE } from "@/features/orders/calendar-date";
import { ITEM_STATUS_LABELS, PAYMENT_METHOD_LABELS, type Payment } from "@/features/orders/domain";
import { AdminDialog } from "@/shared/ui/admin-dialog";
import type { OrderDetail, OrderDetailPair } from "./order-detail";
import { STATUS_TONE } from "./status-tone";
import { UpdateStatusForm } from "./update-status-form";

const shopDay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: SHOP_TIMEZONE,
});
const shopDayTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: SHOP_TIMEZONE,
});
const shopBooked = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: SHOP_TIMEZONE,
});
const calendarDay = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const PAYMENT_STATUS: Record<Payment["status"], { label: string; tone: string }> = {
  PENDING: { label: "Pending", tone: "amber" },
  RECEIVED: { label: "Received", tone: "green" },
  FAILED: { label: "Failed", tone: "red" },
  REFUNDED: { label: "Refunded", tone: "muted" },
};

/** For a `?order=` id no Order has (a stale or mistyped link): a plain message, never a crash. */
export function OrderNotFoundDialog({ closeHref }: { closeHref: string }) {
  return (
    <AdminDialog title="Order not found" closeHref={closeHref} size="sm">
      <p className="od-muted">There&apos;s no order with that reference. It may have been removed, or the link is out of date.</p>
      <div className="od-footer">
        <Link href={closeHref} replace scroll={false} className="admin-btn" data-variant="secondary">
          Close
        </Link>
      </div>
    </AdminDialog>
  );
}

/**
 * Order detail (design: View Recent Order Details): who the customer is,
 * each pair with its Services, where the Order is in the pipeline and how
 * it's being paid. Opened by `?order=<id>` from any Overview list. It's
 * read-only apart from Update Status; Edit Order and the "…" menu have no
 * feature behind them yet (docs/TODO.md), so they aren't drawn.
 */
export function OrderDetailDialog({ detail, closeHref }: { detail: OrderDetail; closeHref: string }) {
  const { customer, payment } = detail;
  const multiple = detail.pairs.length > 1;
  const initials = customer.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");

  return (
    <AdminDialog
      size="lg"
      closeHref={closeHref}
      title={
        <span className="od-title">
          <span className="od-title-icon" aria-hidden="true">
            <PackageIcon size={26} weight="light" />
          </span>
          <span>
            <span className="od-eyebrow">Order</span>
            <span className="od-reference">{detail.reference}</span>
            <span className="od-title-meta">
              <span className="ov-pill" data-tone={STATUS_TONE[detail.status]}>
                {ITEM_STATUS_LABELS[detail.status]}
              </span>
              <span className="od-muted">Booked {shopBooked.format(detail.bookedAt)}</span>
            </span>
          </span>
        </span>
      }
    >
      <div className="od-grid">
        <div className="od-column">
          <section className="ov-card od-card" aria-labelledby="od-customer-title">
            <h3 id="od-customer-title" className="ov-card-title">
              Customer Information
            </h3>
            <div className="od-customer">
              <span className="od-avatar" aria-hidden="true">
                {initials}
              </span>
              <div>
                <p className="od-customer-name">{customer.name}</p>
                <p>
                  <a className="od-link" href={`tel:${customer.phone}`}>
                    <PhoneIcon size={16} aria-hidden="true" /> {customer.phone}
                  </a>
                </p>
                <p>
                  <a className="od-link" href={`mailto:${customer.email}`}>
                    <EnvelopeSimpleIcon size={16} aria-hidden="true" /> {customer.email}
                  </a>
                </p>
              </div>
            </div>
            <dl className="od-facts">
              <div>
                <dt>Fulfillment</dt>
                <dd>
                  {customer.fulfillment}
                  {customer.schedule && (
                    <span className="od-muted">
                      {" "}
                      · {customer.fulfillment === "Mail-In" ? "Ship around " : ""}
                      {calendarDay.format(calendarDateToUtcMidnight(customer.schedule.date))}
                      {customer.schedule.slot ? `, ${customer.schedule.slot}` : ""}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>
                  {customer.address.map((line) => (
                    <span key={line} className="od-line">
                      {line}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </section>

          <section className="ov-card od-card" aria-labelledby="od-items-title">
            <h3 id="od-items-title" className="ov-card-title">
              Order Items{detail.bundleName ? ` · ${detail.bundleName}` : ""}
            </h3>
            <ul className="od-pairs">
              {detail.pairs.map((pair, index) => (
                <Pair key={pair.itemId} pair={pair} label={multiple ? `Pair ${index + 1}` : null} />
              ))}
            </ul>
          </section>
        </div>

        <div className="od-column">
          <section className="ov-card od-card" aria-labelledby="od-status-title">
            <h3 id="od-status-title" className="ov-card-title">
              Order Status
            </h3>
            {multiple && <p className="od-muted od-status-note">The least advanced pair sets the order&apos;s status.</p>}
            <ol className="od-timeline">
              {detail.timeline.map((step) => (
                <li key={step.status} className="od-step" data-state={step.state} data-cancelled={step.status === "CANCELLED"}>
                  <span className="od-step-dot" aria-hidden="true">
                    {step.state === "done" && <CheckIcon size={12} weight="bold" />}
                  </span>
                  <span className="od-step-label" aria-current={step.state === "current" ? "step" : undefined}>
                    {ITEM_STATUS_LABELS[step.status]}
                  </span>
                  {step.at && <span className="od-step-time">{shopDayTime.format(step.at)}</span>}
                </li>
              ))}
            </ol>
            <UpdateStatuses detail={detail} />
          </section>

          <section className="ov-card od-card" aria-labelledby="od-payment-title">
            <h3 id="od-payment-title" className="ov-card-title">
              Payment Information
            </h3>
            <dl className="od-facts">
              {payment.deposit ? (
                <>
                  <div>
                    <dt>Deposit method</dt>
                    <dd>{PAYMENT_METHOD_LABELS[payment.deposit.method]}</dd>
                  </div>
                  <div>
                    <dt>Deposit status</dt>
                    <dd>
                      <span className="ov-pill" data-tone={PAYMENT_STATUS[payment.deposit.status].tone}>
                        {PAYMENT_STATUS[payment.deposit.status].label}
                      </span>
                      {payment.deposit.receivedAt && <span className="od-muted"> {shopDay.format(payment.deposit.receivedAt)}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt>Deposit amount</dt>
                    <dd>{payment.deposit.amount.format()}</dd>
                  </div>
                </>
              ) : (
                <div>
                  <dt>Deposit</dt>
                  <dd className="od-muted">None due</dd>
                </div>
              )}
            </dl>
            <dl className="od-totals">
              <div>
                <dt>Estimate</dt>
                <dd>
                  {payment.estimate.format()}
                  {payment.estimateIsMinimum ? "+" : ""}
                </dd>
              </div>
              {payment.rush && (
                <div>
                  <dt>Rush (included)</dt>
                  <dd>{payment.rush.format()}</dd>
                </div>
              )}
              <div>
                <dt>Deposit due</dt>
                <dd>{payment.depositDue.format()}</dd>
              </div>
            </dl>
          </section>

          <section className="ov-card od-card" aria-labelledby="od-notes-title">
            <h3 id="od-notes-title" className="ov-card-title">
              Notes
            </h3>
            {detail.notes.length === 0 ? (
              <p className="od-muted">No notes on this order.</p>
            ) : (
              <ul className="od-notes">
                {detail.notes.map((note) => (
                  <li key={note.id}>
                    <p>{note.body}</p>
                    <span className="od-muted">{shopDay.format(note.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AdminDialog>
  );
}

function Pair({ pair, label }: { pair: OrderDetailPair; label: string | null }) {
  return (
    <li className="od-pair">
      {pair.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a short-lived storage link, not a static asset next/image can optimize
        <img src={pair.photoUrl} alt="" className="ov-thumb od-pair-photo" />
      ) : (
        <span className="ov-thumb od-pair-photo" aria-hidden="true">
          <SneakerIcon size={26} />
        </span>
      )}
      <div className="od-pair-body">
        <div className="od-pair-head">
          <p className="od-pair-title">
            {label && <span className="od-muted">{label} · </span>}
            {pair.title ?? "Pair"}
          </p>
          <span className="od-pair-price">{pair.estimate.format()}</span>
        </div>
        {pair.details.length > 0 && <p className="od-muted">{pair.details.join(" · ")}</p>}
        <ul className="od-services">
          {pair.services.map((service) => (
            <li key={service.name}>
              <span>{service.name}</span>
              {service.price && <span className="od-muted">{service.price}</span>}
            </li>
          ))}
        </ul>
        {label && (
          <span className="ov-pill" data-tone={STATUS_TONE[pair.status]}>
            {ITEM_STATUS_LABELS[pair.status]}
          </span>
        )}
      </div>
    </li>
  );
}

/** One Update Status form per pair that can still move, each with its own idempotency key. */
function UpdateStatuses({ detail }: { detail: OrderDetail }) {
  const multiple = detail.pairs.length > 1;
  const movable = detail.pairs.map((pair, index) => ({ pair, index })).filter(({ pair }) => pair.nextStatuses.length > 0 || pair.held);
  if (movable.length === 0) return null;
  return (
    <div className="od-status-forms">
      <h4 className="od-subhead">Update Status</h4>
      {movable.map(({ pair, index }) => (
        // Keyed by status so a pair that just moved starts a fresh form (and a fresh key).
        <UpdateStatusForm
          key={`${pair.itemId}:${pair.status}`}
          orderId={detail.orderId}
          itemId={pair.itemId}
          fromStatus={pair.status}
          nextStatuses={pair.nextStatuses}
          held={pair.held}
          idempotencyKey={randomUUID()}
          pairLabel={multiple ? `Pair ${index + 1}${pair.title ? `: ${pair.title}` : ""}` : null}
        />
      ))}
    </div>
  );
}
