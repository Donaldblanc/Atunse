import { ChartBarIcon, CreditCardIcon, PackageIcon, TruckIcon } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/features/orders/domain";
import type { AwaitingPayments } from "@/features/orders/repositories/order-repository";
import { Delta } from "../delta";
import type { AdminOverview } from "../get-admin-overview";
import { overviewHref, type OverviewSelection } from "../overview-range";

export function StatsRow({ overview, selection }: { overview: AdminOverview; selection: OverviewSelection }) {
  const { range } = overview;
  return (
    <section className="ov-stats" aria-label="Key figures">
      <StatCard label="Total Orders" icon={PackageIcon} href={overviewHref(selection, { metric: "orders" })} value={String(overview.orders.current)}>
        <Delta current={overview.orders.current} previous={overview.orders.previous} comparison={range.comparisonLabel} />
      </StatCard>
      <StatCard label="Booked Revenue" icon={ChartBarIcon} href={overviewHref(selection, { metric: "revenue" })} value={overview.bookedRevenue.current.format()}>
        <Delta
          current={overview.bookedRevenue.current.cents}
          previous={overview.bookedRevenue.previous.cents}
          comparison={range.comparisonLabel}
        />
      </StatCard>
      <StatCard label="Pending Payments" icon={CreditCardIcon} href={overviewHref(selection, { attention: "pending-payments" })} value={String(overview.awaitingPayments.payments)}>
        <p className="ov-stat-note">
          {overview.awaitingPayments.payments === 0 ? "Every payment confirmed" : depositSplit(overview.awaitingPayments)}
        </p>
      </StatCard>
      <StatCard label="Ready to Return" icon={TruckIcon} value={String(overview.readyForReturn)} href={overviewHref(selection, { attention: "ready-to-return" })}>
        <p className="ov-stat-note">Ready for Drop-Off/Shipping</p>
      </StatCard>
    </section>
  );
}

/** "3 Zelle · 3 Cash · $280 due": each method that has a payment waiting, then the total. */
function depositSplit({ byMethod, amount }: AwaitingPayments): string {
  const methods = PAYMENT_METHODS.filter((method) => byMethod[method] > 0).map((method) => `${byMethod[method]} ${PAYMENT_METHOD_LABELS[method]}`);
  return [...methods, `${amount.format()} due`].join(" · ");
}

/** With an `href`, the whole card is a link to it (a metric's detail dialog or a Needs Attention panel). */
function StatCard({
  label,
  icon: Icon,
  value,
  href,
  children,
}: {
  label: string;
  icon: Icon;
  value: string;
  href?: string;
  children: React.ReactNode;
}) {
  const content = (
    <>
      <div className="ov-stat-head">
        <h2 className="ov-stat-label">{label}</h2>
        <Icon size={26} weight="light" className="ov-stat-icon" aria-hidden="true" />
      </div>
      <p className="ov-stat-value">{value}</p>
      {children}
    </>
  );
  return href ? (
    <Link className="ov-card ov-stat ov-stat-clickable" href={href} scroll={false}>
      {content}
    </Link>
  ) : (
    <div className="ov-card ov-stat">{content}</div>
  );
}
