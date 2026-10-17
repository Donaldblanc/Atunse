// The admin Calendar: a month grid of scheduled visits (collections and
// returns). Reuses getAdminCalendar's query (the same listAppointmentsBetween
// and live-visit filter as Today's Schedule) and the Overview's Schedule
// Item dialog (/admin?visit=) for a visit's details and its Reschedule /
// Mark as Completed actions, rather than reimplementing either.

import Link from "next/link";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import { cookies } from "next/headers";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import "@/features/admin-overview/calendar-grid.css";
import { calendarHref, parseMonthParam } from "@/features/admin-overview/calendar-month";
import { buildAdminOverviewDeps } from "@/features/admin-overview/deps";
import { getAdminCalendar } from "@/features/admin-overview/get-admin-calendar";
import { APPOINTMENT_KIND_LABELS } from "@/features/orders/domain";
import { calendarDateInShopTime } from "@/features/orders/calendar-date";

export const metadata = { title: "Calendar · Atunṣe Admin" };

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthTitle = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const dayNumber = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "UTC" });

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AdminCalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actingUser = await actingUserFromCookies(await cookies());
  const deps = buildAdminOverviewDeps();
  const now = deps.now();

  const month = parseMonthParam(params.month, now);
  const { grid, visitsByDay } = await getAdminCalendar(deps, actingUser, month);
  const today = calendarDateInShopTime(now);

  return (
    <div className="ov-card">
      <div className="cal-nav">
        <Link className="admin-btn" data-variant="secondary" href={calendarHref(grid.previousMonth, now)} aria-label="Previous month">
          <CaretLeftIcon size={16} aria-hidden="true" />
        </Link>
        <h1 className="cal-nav-title">{monthTitle.format(new Date(`${grid.month}T00:00:00Z`))}</h1>
        <Link className="admin-btn" data-variant="secondary" href={calendarHref(grid.nextMonth, now)} aria-label="Next month">
          <CaretRightIcon size={16} aria-hidden="true" />
        </Link>
      </div>

      <div className="cal-grid">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="cal-weekday">
            {label}
          </div>
        ))}
        {grid.days.map((day) => {
          const visits = visitsByDay.get(day) ?? [];
          const outside = day < grid.month || day >= grid.nextMonth;
          return (
            <div key={day} className="cal-day" data-outside={outside} data-today={day === today}>
              <span className="cal-day-num">{dayNumber.format(new Date(`${day}T00:00:00Z`))}</span>
              {visits.map((visit) => (
                <Link
                  key={visit.appointmentId}
                  href={`/admin?visit=${visit.appointmentId}&calendarMonth=${grid.month.slice(0, 7)}`}
                  className="cal-visit"
                  data-kind={visit.kind}
                  title={`${APPOINTMENT_KIND_LABELS[visit.kind]} · ${visit.time} · ${visit.customerName} (${visit.reference})`}
                >
                  {visit.time} {APPOINTMENT_KIND_LABELS[visit.kind]} – {visit.customerName}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
