import { ChartBarIcon, PackageIcon } from "@phosphor-icons/react/dist/ssr";
import { ITEM_STATUS_LABELS } from "@/features/orders/domain";
import { Money } from "@/shared/money/money";
import { AdminDialog } from "@/shared/ui/admin-dialog";
import { countTicks, dollarTicks, sharesOf100 } from "./chart-scale";
import { Delta } from "./delta";
import type { AdminOverview } from "./get-admin-overview";
import { MetricChart } from "./metric-chart";
import type { OverviewMetric } from "./metric-detail";
import { STATUS_TONE } from "./status-tone";

const ordersLabel = (count: number) => `${count} ${count === 1 ? "order" : "orders"}`;

/**
 * "View Metric Details" for Total Orders or Booked Revenue: the headline
 * with its change, the range day by day, and the same Orders split by
 * status. Revenue splits by status too (not by Service, which Orders by
 * Service already covers) so the two dialogs read alike and their numbers
 * tie back to the same Orders. The headline and the breakdown both leave
 * fully cancelled Orders out; those are counted beneath the list.
 */
export function MetricDetailDialog({ metric, overview, closeHref }: { metric: OverviewMetric; overview: AdminOverview; closeHref: string }) {
  const { range, metricDetail: detail } = overview;
  const isOrders = metric === "orders";
  const Icon = isOrders ? PackageIcon : ChartBarIcon;
  const label = isOrders ? "Total Orders" : "Booked Revenue";

  const chartDays = isOrders
    ? detail.ordersByDay.map((day) => ({ date: day.date, value: day.orders }))
    : overview.revenueByDay.map((day) => ({ date: day.date, value: day.revenue.cents / 100 }));
  const peak = Math.max(...chartDays.map((day) => day.value));
  const shares = sharesOf100(detail.byStatus.map((status) => (isOrders ? status.orders : status.revenue.cents)));

  return (
    <AdminDialog
      size="lg"
      closeHref={closeHref}
      title={
        <span className="md-title">
          <Icon size={22} weight="light" aria-hidden="true" />
          {label}
        </span>
      }
    >
      <div className="md">
        <div className="md-headline">
          <p className="md-value">{isOrders ? String(overview.orders.current) : overview.bookedRevenue.current.format()}</p>
          {isOrders ? (
            <Delta current={overview.orders.current} previous={overview.orders.previous} comparison={range.comparisonLabel} />
          ) : (
            <Delta current={overview.bookedRevenue.current.cents} previous={overview.bookedRevenue.previous.cents} comparison={range.comparisonLabel} />
          )}
        </div>

        <section aria-labelledby="md-chart-title">
          <h3 id="md-chart-title" className="md-heading">
            {isOrders ? "Orders per day" : "Booked revenue per day"}
          </h3>
          <MetricChart
            days={chartDays}
            ticks={isOrders ? countTicks(peak) : dollarTicks(peak)}
            formatTick={isOrders ? String : (tick) => `$${tick.toLocaleString("en-US")}`}
            describe={isOrders ? ordersLabel : (value) => `${Money.fromCents(Math.round(value * 100)).format()} booked`}
          />
        </section>

        <section aria-labelledby="md-status-title">
          <h3 id="md-status-title" className="md-heading">
            {isOrders ? "Order Status Breakdown" : "Booked Revenue by Order Status"}
          </h3>
          {detail.byStatus.length === 0 ? (
            <p className="ov-empty">No orders booked in this range.</p>
          ) : (
            <ul className="md-status">
              {detail.byStatus.map((status, i) => (
                <li key={status.status}>
                  <span className="md-dot" data-tone={STATUS_TONE[status.status]} aria-hidden="true" />
                  <span className="md-status-name">{ITEM_STATUS_LABELS[status.status]}</span>
                  <span className="md-status-value">{isOrders ? status.orders : status.revenue.format()}</span>
                  <span className="md-status-share">{shares[i]}%</span>
                </li>
              ))}
            </ul>
          )}
          <p className="ov-footnote">
            Each Order sits at its least advanced pair. Percentages are shares of the {isOrders ? "orders" : "booked revenue"} counted above.
          </p>
          {detail.cancelledOrders > 0 && (
            <p className="md-cancelled">
              <span className="md-dot" data-tone="muted" aria-hidden="true" />
              <span>
                {ordersLabel(detail.cancelledOrders)} booked in this range {detail.cancelledOrders === 1 ? "was" : "were"} cancelled. Cancelled orders aren&apos;t
                in {isOrders ? "the total" : "the revenue"} or the list above.
              </span>
            </p>
          )}
        </section>
      </div>
    </AdminDialog>
  );
}
