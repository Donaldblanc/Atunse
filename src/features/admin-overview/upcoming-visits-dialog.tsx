import Link from "next/link";
import { APPOINTMENT_KIND_LABELS } from "@/features/orders/domain";
import { AdminDialog } from "@/shared/ui/admin-dialog";
import "./find-orders.css";
import { overviewHref, type OverviewSelection } from "./overview-range";
import type { UpcomingVisit } from "./upcoming-visits";

/** The dialog behind "View calendar" (`?visits=upcoming`): the next 14 days of visits. Rows open the Schedule Item dialog. */
export function UpcomingVisitsDialog({ visits, selection }: { visits: UpcomingVisit[]; selection: OverviewSelection }) {
  return (
    <AdminDialog title="Upcoming visits" closeHref={overviewHref(selection)} size="md">
      {visits.length === 0 ? (
        <p className="ov-empty">Nothing scheduled in the next 14 days.</p>
      ) : (
        <div className="att-scroll">
          <table className="ov-table att-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Customer</th>
                <th scope="col">Visit</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((visit) => (
                <tr key={visit.appointmentId} className="ov-row-link">
                  <td className="ov-ref">
                    <Link
                      href={overviewHref(selection, { visit: visit.appointmentId })}
                      scroll={false}
                      aria-label={`${APPOINTMENT_KIND_LABELS[visit.kind]} for ${visit.customerName}, ${visit.day} at ${visit.time}`}
                    >
                      {visit.day}, {visit.time}
                    </Link>
                  </td>
                  <td>
                    <span className="ov-cell-main">{visit.customerName}</span>
                    <span className="ov-cell-sub">{visit.reference}</span>
                  </td>
                  <td>
                    <span className="ov-tag" data-kind={visit.kind}>
                      {APPOINTMENT_KIND_LABELS[visit.kind]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminDialog>
  );
}
