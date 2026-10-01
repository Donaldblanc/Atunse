import type { AdminOverview } from "../get-admin-overview";
import { OVERVIEW_RANGE_LABELS } from "../overview-range";
import { ServicesDonut } from "../services-donut";

export function ServicesCard({ overview }: { overview: AdminOverview }) {
  return (
    <section className="ov-card" aria-labelledby="ov-services-title">
      <div className="ov-card-head">
        <h2 id="ov-services-title" className="ov-card-title">
          Orders by Service
        </h2>
        <span className="ov-chip">{OVERVIEW_RANGE_LABELS[overview.range.id]}</span>
      </div>
      <ServicesDonut services={overview.servicesBooked} />
    </section>
  );
}
