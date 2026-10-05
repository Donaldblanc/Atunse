import type { CalendarDate } from "@/features/orders/calendar-date";
import { Delta } from "../delta";
import type { AdminOverview } from "../get-admin-overview";
import Link from "next/link";
import { revenueTrendTitleHref } from "../chart-links";
import { OVERVIEW_RANGE_LABELS, type OverviewSelection } from "../overview-range";
import { RangeChip } from "../range-chip";
import { RevenueTrend } from "../revenue-trend";

export function RevenueTrendCard({
  overview,
  highlight,
  today,
  selection,
}: {
  overview: AdminOverview;
  highlight: CalendarDate;
  today: CalendarDate;
  selection: OverviewSelection;
}) {
  const { range } = overview;
  return (
    <section className="ov-card" aria-labelledby="ov-trend-title">
      <div className="ov-card-head">
        <h2 id="ov-trend-title" className="ov-card-title">
          <Link className="cd-title-link" href={revenueTrendTitleHref(selection)} scroll={false}>
            Revenue Trend
          </Link>
        </h2>
        <RangeChip label={OVERVIEW_RANGE_LABELS[range.id]} />
      </div>
      <div className="ov-trend-total">
        <strong>{overview.bookedRevenue.current.format()}</strong>
        <Delta current={overview.bookedRevenue.current.cents} previous={overview.bookedRevenue.previous.cents} comparison={range.comparisonLabel} />
      </div>
      <RevenueTrend days={overview.revenueByDay} highlight={highlight} today={today} selection={selection} />
      <p className="ov-footnote">Booked estimates by the day they were booked, not payments received.</p>
    </section>
  );
}
