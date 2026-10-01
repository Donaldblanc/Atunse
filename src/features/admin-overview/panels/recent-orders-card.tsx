import type { AdminOverview } from "../get-admin-overview";
import type { OverviewSelection } from "../overview-range";
import { RecentOrders } from "../recent-orders";
import { CardLink } from "./card-link";

export function RecentOrdersCard({ overview, selection, ordersHref }: { overview: AdminOverview; selection: OverviewSelection; ordersHref: string | null }) {
  return (
    <section className="ov-card" aria-labelledby="ov-recent-title">
      <div className="ov-card-head">
        <h2 id="ov-recent-title" className="ov-card-title">
          Recent Orders
        </h2>
        {ordersHref && <CardLink href={ordersHref}>View all orders</CardLink>}
      </div>
      <RecentOrders orders={overview.recentOrders} selection={selection} />
    </section>
  );
}
