import type { AdminOverview } from "../get-admin-overview";
import { OVERVIEW_RANGE_LABELS, type OverviewSelection } from "../overview-range";
import { RangeChip } from "../range-chip";
import { ServicesDonut } from "../services-donut";

export function ServicesCard({ overview, selection }: { overview: AdminOverview; selection: OverviewSelection }) {
  return (
    <section className="ov-card" aria-labelledby="ov-services-title">
      <div className="ov-card-head">
        <h2 id="ov-services-title" className="ov-card-title">
          Orders by Service
        </h2>
        <RangeChip label={OVERVIEW_RANGE_LABELS[overview.range.id]} />
      </div>
      <ServicesDonut services={overview.servicesBooked} selection={selection} />
    </section>
  );
}
