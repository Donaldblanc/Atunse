import type { CalendarDate } from "@/features/orders/calendar-date";
import { Delta } from "../delta";
import type { AdminOverview } from "../get-admin-overview";
import { OVERVIEW_RANGE_LABELS } from "../overview-range";
import { RevenueTrend } from "../revenue-trend";

export function RevenueTrendCard({ overview, highlight }: { overview: AdminOverview; highlight: CalendarDate }) {
  const { range } = overview;
  return (
    <section className="ov-card" aria-labelledby="ov-trend-title">
      <div className="ov-card-head">
        <h2 id="ov-trend-title" className="ov-card-title">
          Revenue Trend
        </h2>
        <span className="ov-chip">{OVERVIEW_RANGE_LABELS[range.id]}</span>
      </div>
      <div className="ov-trend-total">
        <strong>{overview.bookedRevenue.current.format()}</strong>
        <Delta
          current={overview.bookedRevenue.current.cents}
          previous={overview.bookedRevenue.previous.cents}
          comparison={range.comparisonLabel}
        />
      </div>
      <RevenueTrend days={overview.revenueByDay} highlight={highlight} />
      <p className="ov-footnote">Booked estimates by the day they were booked, not payments received.</p>
    </section>
  );
}
