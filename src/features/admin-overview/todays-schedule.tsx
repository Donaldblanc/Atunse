import Link from "next/link";
import type { ScheduledVisit } from "./get-admin-overview";
import { overviewHref, type OverviewSelection } from "./overview-range";

const VISIT_LABELS: Record<ScheduledVisit["kind"], string> = { COLLECTION: "Collection", RETURN: "Return" };

/**
 * Today's Local Drop-Off visits as a timeline: collections and returns, from
 * the Calendar's Appointments. Each opens its Schedule Item dialog
 * (`?visit=`), keeping the page's range.
 */
export function TodaysSchedule({ visits, selection }: { visits: ScheduledVisit[]; selection: OverviewSelection }) {
  if (visits.length === 0) return <p className="ov-empty">Nothing scheduled for today.</p>;
  return (
    <ol className="ov-schedule">
      {visits.map((visit) => (
        <li key={visit.appointmentId}>
          <span className="ov-schedule-time">{visit.time}</span>
          <span className="ov-schedule-dot" aria-hidden="true" />
          <span className="ov-schedule-what">
            {/* The link's ::after stretches over the whole row, so the row is one big target. */}
            <Link className="ov-schedule-link ov-cell-main" href={overviewHref(selection, { visit: visit.appointmentId })} scroll={false}>
              {visit.customerName}
              <span className="sr-only">, {VISIT_LABELS[visit.kind]} at {visit.time}</span>
            </Link>
            <span className="ov-cell-sub">{visit.reference}</span>
          </span>
          <span className="ov-tag" data-kind={visit.kind}>
            {VISIT_LABELS[visit.kind]}
          </span>
        </li>
      ))}
    </ol>
  );
}
