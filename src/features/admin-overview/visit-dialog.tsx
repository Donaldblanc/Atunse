import { CheckCircleIcon, ClockIcon, EnvelopeSimpleIcon, MapPinIcon, PhoneIcon, SneakerIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { AdminDialog } from "@/shared/ui/admin-dialog";
import { completeVisitAction } from "./complete-visit-action";
import { overviewHref, rangeSearchParams, type OverviewSelection } from "./overview-range";
import type { ScheduledVisitDetail } from "./scheduled-visit";


const KIND_LABELS: Record<ScheduledVisitDetail["kind"], string> = { COLLECTION: "Collection", RETURN: "Return" };
const STATUS_LABELS: Record<ScheduledVisitDetail["status"], string> = { SCHEDULED: "Scheduled", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const STATUS_TONE: Record<ScheduledVisitDetail["status"], string> = { SCHEDULED: "blue", COMPLETED: "green", CANCELLED: "muted" };

/** "Sarah Kim" -> "SK". */
function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * The Overview's Schedule Item dialog (`?visit=`): who the visit is with and
 * where, the Order it belongs to, and the visit's own status. `visit` is null
 * when the link points at an Appointment that no longer exists.
 */
export function VisitDialog({ visit, selection }: { visit: ScheduledVisitDetail | null; selection: OverviewSelection }) {
  const closeHref = overviewHref(selection);
  const title = (
    <span className="visit-title">
      <ClockIcon size={22} aria-hidden="true" /> Schedule Item
    </span>
  );

  if (!visit) {
    return (
      <AdminDialog title={title} closeHref={closeHref} size="sm">
        <p className="ov-empty">This visit no longer exists. It may have been removed.</p>
      </AdminDialog>
    );
  }

  const detailsLabel = `${KIND_LABELS[visit.kind]} Details`;
  const orderHref = overviewHref(selection, { order: visit.order.id });
  return (
    <AdminDialog title={title} closeHref={closeHref} size="lg">
      <div className="visit-summary">
        <span className="visit-summary-icon" aria-hidden="true">
          <ClockIcon size={26} />
        </span>
        <div className="visit-summary-text">
          <p className="visit-summary-name">
            {KIND_LABELS[visit.kind]} – {visit.customer.name}{" "}
            <span className="ov-tag" data-kind={visit.kind}>
              {KIND_LABELS[visit.kind]}
            </span>
          </p>
          <p className="ov-cell-sub">
            {visit.window} · {visit.date}
          </p>
        </div>
      </div>

      <div className="visit-columns">
        <div className="visit-column">
          <section className="visit-section" aria-labelledby="visit-customer">
            <h3 id="visit-customer" className="visit-heading">
              Customer Information
            </h3>
            <div className="visit-customer">
              <span className="ov-review-avatar" aria-hidden="true">
                {initials(visit.customer.name)}
              </span>
              <div className="visit-customer-lines">
                <strong>{visit.customer.name}</strong>
                <a className="visit-line" href={`tel:${visit.customer.phone.replace(/[^\d+]/g, "")}`}>
                  <PhoneIcon size={16} aria-hidden="true" /> {visit.customer.phone}
                </a>
                <a className="visit-line" href={`mailto:${visit.customer.email}`}>
                  <EnvelopeSimpleIcon size={16} aria-hidden="true" /> {visit.customer.email}
                </a>
                <span className="visit-line">
                  <MapPinIcon size={16} aria-hidden="true" /> {visit.customer.address}
                </span>
              </div>
            </div>
          </section>

          <section className="visit-section" aria-labelledby="visit-order">
            <h3 id="visit-order" className="visit-heading">
              Order Details
            </h3>
            <div className="visit-order">
              {visit.order.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- a short-lived storage link, not a static asset next/image can optimize
                <img src={visit.order.photoUrl} alt="" className="ov-thumb visit-thumb" />
              ) : (
                <span className="ov-thumb visit-thumb" aria-hidden="true">
                  <SneakerIcon size={28} />
                </span>
              )}
              <div className="visit-order-lines">
                <Link className="ov-ref visit-order-link" href={orderHref} scroll={false}>
                  {visit.order.reference}
                </Link>
                {visit.order.firstPair && <span className="ov-cell-main">{visit.order.firstPair}</span>}
                {visit.order.pairCount > 1 && <span className="ov-cell-sub">{visit.order.pairCount} pairs</span>}
                <span className="ov-cell-sub">
                  Estimate {visit.order.estimateIsMinimum ? "from " : ""}
                  {visit.order.estimate.format()}
                </span>
                {visit.order.services && <span className="ov-cell-sub">Services: {visit.order.services}</span>}
              </div>
            </div>
          </section>
        </div>

        <section className="visit-section" aria-labelledby="visit-details">
          <h3 id="visit-details" className="visit-heading">
            {detailsLabel}
          </h3>
          <dl className="visit-facts">
            <div>
              <dt>Time</dt>
              <dd>{visit.window}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className="ov-pill" data-tone={STATUS_TONE[visit.status]}>
                  {STATUS_LABELS[visit.status]}
                </span>
              </dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{visit.customer.address}</dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{visit.notes ?? <span className="ov-cell-sub">No notes</span>}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="visit-actions">
        {visit.status === "SCHEDULED" && (
          <form action={completeVisitAction}>
            <input type="hidden" name="appointmentId" value={visit.appointmentId} />
            {[...rangeSearchParams(selection)].map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <button type="submit" className="admin-btn">
              <CheckCircleIcon size={18} aria-hidden="true" /> Mark as Completed
            </button>
          </form>
        )}
        <a className="admin-btn" data-variant="secondary" href={`tel:${visit.customer.phone.replace(/[^\d+]/g, "")}`}>
          <PhoneIcon size={18} aria-hidden="true" /> Contact Customer
        </a>
        <button type="button" className="admin-btn" data-variant="secondary" disabled title="Rescheduling arrives with the Calendar (docs/TODO.md)">
          Reschedule
        </button>
      </div>
    </AdminDialog>
  );
}
