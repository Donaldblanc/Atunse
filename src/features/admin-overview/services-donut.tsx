import Link from "next/link";
import { SERVICE_CATALOG } from "@/features/orders/service-catalog";
import { serviceLegendHref } from "./chart-links";
import { donutSegments, sharesOf100 } from "./chart-scale";
import type { OverviewSelection } from "./overview-range";

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** The surface-colored gap between neighbouring segments, in viewBox units. */
const GAP = 1.6;

/**
 * Colour follows the Service, never its rank: each catalog Service owns
 * one categorical slot (--series-1..8 in admin-theme.css), so a Service
 * keeps its colour whichever others were booked.
 */
function seriesVar(serviceId: string): string {
  return `var(--series-${SERVICE_CATALOG.findIndex((s) => s.id === serviceId) + 1})`;
}

/**
 * How many pairs included each Service. A pair can take several (a
 * cleaning tier plus add-ons), so the ring's whole is Service bookings,
 * not pairs. The legend always prints every name, count and share, so no
 * value depends on colour or hover alone.
 */
export function ServicesDonut({ services, selection }: { services: { serviceId: string; name: string; count: number }[]; selection: OverviewSelection }) {
  const total = services.reduce((sum, service) => sum + service.count, 0);
  const segments = donutSegments(services.map((service) => service.count));
  const shares = sharesOf100(services.map((service) => service.count));
  const gap = services.length > 1 ? GAP : 0;

  return (
    <div className="ov-donut">
      <div className="ov-donut-ring">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r={RADIUS} className="ov-donut-track" />
          {services.map((service, i) => {
            const segment = segments[i]!;
            return (
              <circle
                key={service.serviceId}
                cx="60"
                cy="60"
                r={RADIUS}
                className="ov-donut-segment"
                stroke={seriesVar(service.serviceId)}
                strokeDasharray={`${Math.max(segment.length * CIRCUMFERENCE - gap, 0)} ${CIRCUMFERENCE}`}
                strokeDashoffset={-segment.offset * CIRCUMFERENCE}
              >
                <title>{`${service.name}: ${service.count} (${shares[i]}%)`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="ov-donut-center">
          <strong>{total}</strong>
          <span>{total === 1 ? "service booked" : "services booked"}</span>
        </div>
      </div>

      {services.length === 0 ? (
        <p className="ov-empty">No pairs booked in this range yet.</p>
      ) : (
        <ul className="ov-legend">
          {services.map((service, i) => (
            <li key={service.serviceId}>
              <Link
                className="cd-legend-link"
                href={serviceLegendHref(selection, service.serviceId)}
                scroll={false}
                aria-label={`${service.name}: ${service.count} ${service.count === 1 ? "order" : "orders"} this range`}
              >
                <span className="ov-legend-key" style={{ background: seriesVar(service.serviceId) }} aria-hidden="true" />
                <span className="ov-legend-name">{service.name}</span>
                <span className="ov-legend-count">{service.count}</span>
                <span className="ov-legend-share">{shares[i]}%</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
