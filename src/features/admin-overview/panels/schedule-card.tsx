import type { AdminOverview } from "../get-admin-overview";
import type { OverviewSelection } from "../overview-range";
import { TodaysSchedule } from "../todays-schedule";
import { CardLink } from "./card-link";

export function ScheduleCard({ overview, selection, calendarHref }: { overview: AdminOverview; selection: OverviewSelection; calendarHref: string | null }) {
  return (
    <section className="ov-card" aria-labelledby="ov-schedule-title">
      <div className="ov-card-head">
        <h2 id="ov-schedule-title" className="ov-card-title">
          Today&apos;s Schedule
        </h2>
        {calendarHref && <CardLink href={calendarHref}>View calendar</CardLink>}
      </div>
      <TodaysSchedule visits={overview.todaysSchedule} selection={selection} />
    </section>
  );
}
