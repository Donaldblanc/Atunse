import { CalendarPlusIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ActingUser } from "@/features/accounts/authz";
import { calendarDateInShopTime } from "@/features/orders/calendar-date";
import { AdminDialog } from "@/shared/ui/admin-dialog";
import { overviewHref, rangeSearchParams, type OverviewSelection } from "./overview-range";
import { getReturnBooking } from "./return-booking";
import type { ScheduledVisitDetail } from "./scheduled-visit";
import { buildVisitDeps } from "./visit-deps";
import { VisitScheduleForm } from "./visit-schedule-form";

const KIND_LABELS = { COLLECTION: "collection", RETURN: "return" } as const;

/** The Overview's range params as plain fields, so a submitted form's redirect keeps them. */
function rangeFields(selection: OverviewSelection): Record<string, string> {
  return Object.fromEntries(rangeSearchParams(selection));
}

/** `?visit=<id>&reschedule=1`: pick a new date and slot for a SCHEDULED visit. */
export function RescheduleDialog({ visit, selection, now }: { visit: ScheduledVisitDetail; selection: OverviewSelection; now: Date }) {
  const backHref = overviewHref(selection, { visit: visit.appointmentId });
  const title = `Reschedule ${KIND_LABELS[visit.kind]}`;
  if (visit.status !== "SCHEDULED") {
    return (
      <AdminDialog title={title} closeHref={overviewHref(selection)} size="sm">
        <p className="ov-empty">This visit is {visit.status === "COMPLETED" ? "already completed" : "cancelled"}, so it can&apos;t be moved.</p>
        <div className="vsf-actions">
          <Link className="admin-btn" data-variant="secondary" href={backHref} replace scroll={false}>
            Back to visit
          </Link>
        </div>
      </AdminDialog>
    );
  }
  const today = calendarDateInShopTime(now);
  const visitDay = calendarDateInShopTime(visit.startsAt);
  return (
    <AdminDialog title={title} closeHref={overviewHref(selection)} size="sm">
      <p className="vsf-current">
        {visit.customer.name} · currently {visit.date}, {visit.window}
      </p>
      <VisitScheduleForm
        mode="reschedule"
        hidden={{ appointmentId: visit.appointmentId, expectedStartsAt: visit.startsAt.toISOString(), ...rangeFields(selection) }}
        customer={visit.customer}
        now={now.toISOString()}
        initialDate={visitDay < today ? today : visitDay}
        cancelHref={backHref}
      />
    </AdminDialog>
  );
}

/** `?order=<id>&book=return`: pick the slot for DJ to drop the pairs back off. Replaces the Order dialog while open. */
export async function ReturnBookingDialog({ orderId, selection, actingUser, now }: { orderId: string; selection: OverviewSelection; actingUser: ActingUser; now: Date }) {
  const booking = await getReturnBooking(buildVisitDeps(), actingUser, orderId);
  const closeHref = overviewHref(selection);
  const backHref = overviewHref(selection, { order: orderId });
  const back = (
    <div className="vsf-actions">
      <Link className="admin-btn" data-variant="secondary" href={backHref} replace scroll={false}>
        Back to order
      </Link>
    </div>
  );

  if (!booking) {
    return (
      <AdminDialog title="Book return visit" closeHref={closeHref} size="sm">
        <p className="ov-empty">This order no longer exists.</p>
      </AdminDialog>
    );
  }
  const title = `Book return visit · ${booking.reference}`;
  if (booking.state.kind === "booked") {
    return (
      <AdminDialog title={title} closeHref={closeHref} size="sm">
        <p className="ov-empty">
          A return visit is already booked for {booking.booked!.when}.{" "}
          <Link className="od-link" href={overviewHref(selection, { visit: booking.booked!.appointmentId })} replace scroll={false}>
            Open it
          </Link>{" "}
          to reschedule.
        </p>
        {back}
      </AdminDialog>
    );
  }
  if (booking.state.kind === "unavailable") {
    return (
      <AdminDialog title={title} closeHref={closeHref} size="sm">
        <p className="ov-empty">
          {booking.state.reason === "mail-in" ? "Mail-In orders are shipped back, so they have no return visit." : "No pair on this order is ready to go back yet."}
        </p>
        {back}
      </AdminDialog>
    );
  }
  return (
    <AdminDialog title={title} closeHref={closeHref} size="sm">
      <p className="vsf-current">{booking.customer.name} · Local Drop-Off</p>
      <VisitScheduleForm
        mode="return"
        hidden={{ orderId, ...rangeFields(selection) }}
        customer={booking.customer}
        now={now.toISOString()}
        initialDate={calendarDateInShopTime(now)}
        cancelHref={backHref}
      />
    </AdminDialog>
  );
}

/**
 * The Order dialog's entry to the Return picker: a "Book return visit"
 * button when a Return can be booked, the booked time (linking to the
 * visit) when one exists, and nothing for Mail-In or an Order with no pair
 * ready. Loads the Order itself so order-detail-dialog.tsx stays one line.
 */
export async function BookReturnAction({ orderId, selection, actingUser }: { orderId: string; selection: OverviewSelection; actingUser: ActingUser }) {
  const booking = await getReturnBooking(buildVisitDeps(), actingUser, orderId);
  if (!booking) return null;
  if (booking.booked) {
    return (
      <p className="od-return">
        Return visit:{" "}
        <Link className="od-link" href={overviewHref(selection, { visit: booking.booked.appointmentId })} scroll={false}>
          {booking.booked.when}
        </Link>
      </p>
    );
  }
  if (booking.state.kind !== "bookable") return null;
  return (
    <div className="od-return">
      <Link className="admin-btn" data-variant="secondary" href={overviewHref(selection, { order: orderId, book: "return" })} replace scroll={false}>
        <CalendarPlusIcon size={18} aria-hidden="true" /> Book return visit
      </Link>
    </div>
  );
}
