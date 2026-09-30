// The admin Overview: the first screen of the admin design
// (scratch/01-overview-dashboard.png). Reachable only past src/proxy.ts's
// admin guard and the admin layout's own check; getAdminOverview checks
// the role again itself (ADR-0012).
//
// Booked orders and revenue follow the range picker; the work queues
// (quotes, deposits, pairs to return) are always "right now".
import {
  ArrowRightIcon,
  ClipboardTextIcon,
  CreditCardIcon,
  PackageIcon,
  ReceiptIcon,
  TruckIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { cookies } from "next/headers";
import Link from "next/link";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { Delta } from "@/features/admin-overview/delta";
import { buildAdminOverviewDeps } from "@/features/admin-overview/deps";
import { getAdminOverview } from "@/features/admin-overview/get-admin-overview";
import { greeting } from "@/features/admin-overview/greeting";
import { formatRangeDates, OVERVIEW_RANGE_LABELS, parseOverviewRangeId } from "@/features/admin-overview/overview-range";
import { RangePicker } from "@/features/admin-overview/range-picker";
import { RevenueTrend } from "@/features/admin-overview/revenue-trend";
import { ServicesDonut } from "@/features/admin-overview/services-donut";
import { calendarDateInShopTime } from "@/features/orders/calendar-date";
import { builtScreenHref, OWNER_DISPLAY_NAME } from "./admin-screens";

export const metadata = { title: "Overview · Atunṣe Admin" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AdminOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const rangeId = parseOverviewRangeId((await searchParams).range);
  const actingUser = await actingUserFromCookies(await cookies());
  const deps = buildAdminOverviewDeps();
  const overview = await getAdminOverview(deps, actingUser, rangeId);
  const { range } = overview;

  const today = calendarDateInShopTime(deps.now());
  const highlight = range.days.includes(today) ? today : range.days[range.days.length - 1]!;
  const ordersHref = builtScreenHref("orders");

  return (
    <div className="ov">
      <div className="ov-header">
        <div>
          <h1 className="ov-title">
            {greeting(deps.now())}, <span>{OWNER_DISPLAY_NAME}</span>{" "}
            <span className="ov-wave" aria-hidden="true">
              👋
            </span>
          </h1>
          <p className="ov-subtitle">Here&apos;s what&apos;s happening with your business today.</p>
        </div>
        <RangePicker current={rangeId} datesLabel={formatRangeDates(range)} />
      </div>

      <section className="ov-stats" aria-label="Key figures">
        <StatCard label="Total Orders" icon={PackageIcon} value={String(overview.orders.current)}>
          <Delta current={overview.orders.current} previous={overview.orders.previous} comparison={range.comparisonLabel} />
        </StatCard>
        <StatCard label="Booked Revenue" icon={ReceiptIcon} value={overview.bookedRevenue.current.format()}>
          <Delta
            current={overview.bookedRevenue.current.cents}
            previous={overview.bookedRevenue.previous.cents}
            comparison={range.comparisonLabel}
          />
        </StatCard>
        <StatCard label="Awaiting Deposit" icon={CreditCardIcon} value={String(overview.awaitingDeposit.orders)}>
          <p className="ov-stat-note">
            {overview.awaitingDeposit.orders === 0
              ? "Every deposit confirmed"
              : `${overview.awaitingDeposit.deposits.format()} in Zelle/Cash to confirm`}
          </p>
        </StatCard>
        <StatCard label="Ready for Drop-Off/Shipping" icon={TruckIcon} value={String(overview.readyForReturn)}>
          {ordersHref ? (
            <Link className="ov-stat-link" href={`${ordersHref}?status=READY_FOR_PICKUP_SHIPPING`}>
              View orders <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
            </Link>
          ) : (
            <p className="ov-stat-note">{overview.readyForReturn === 1 ? "Finished pair to return" : "Finished pairs to return"}</p>
          )}
        </StatCard>
      </section>

      <div className="ov-charts">
        <section className="ov-card" aria-labelledby="ov-trend-title">
          <div className="ov-card-head">
            <h2 id="ov-trend-title" className="ov-card-title">
              Revenue Trend
            </h2>
            <span className="ov-chip">{OVERVIEW_RANGE_LABELS[rangeId]}</span>
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

        <section className="ov-card" aria-labelledby="ov-services-title">
          <div className="ov-card-head">
            <h2 id="ov-services-title" className="ov-card-title">
              Orders by Service
            </h2>
            <span className="ov-chip">{OVERVIEW_RANGE_LABELS[rangeId]}</span>
          </div>
          <ServicesDonut services={overview.servicesBooked} />
        </section>
      </div>

      <section className="ov-card" aria-labelledby="ov-attention-title">
        <h2 id="ov-attention-title" className="ov-card-title">
          Needs Attention
        </h2>
        <ul className="ov-attention">
          <AttentionItem
            tone="red"
            icon={CreditCardIcon}
            title="Pending Deposits"
            detail="Awaiting customer payment"
            count={overview.awaitingDeposit.orders}
          />
          <AttentionItem
            tone="orange"
            icon={PackageIcon}
            title="Ready to Return"
            detail="Completed and ready to go back"
            count={overview.readyForReturn}
          />
          <AttentionItem
            tone="violet"
            icon={ClipboardTextIcon}
            title="Needs a Quote"
            detail="Pairs waiting on your review"
            count={overview.needsQuote}
          />
        </ul>
      </section>
    </div>
  );
}

function StatCard({ label, icon: Icon, value, children }: { label: string; icon: Icon; value: string; children: React.ReactNode }) {
  return (
    <div className="ov-card ov-stat">
      <div className="ov-stat-head">
        <h2 className="ov-stat-label">{label}</h2>
        <Icon size={30} weight="light" className="ov-stat-icon" aria-hidden="true" />
      </div>
      <p className="ov-stat-value">{value}</p>
      {children}
    </div>
  );
}

function AttentionItem({
  tone,
  icon: Icon,
  title,
  detail,
  count,
}: {
  tone: "red" | "orange" | "violet";
  icon: Icon;
  title: string;
  detail: string;
  count: number;
}) {
  return (
    <li className="ov-attention-item">
      <span className="ov-attention-icon" data-tone={tone} aria-hidden="true">
        <Icon size={22} />
      </span>
      <span className="ov-attention-text">
        <strong>{title}</strong>
        <span>{detail}</span>
      </span>
      <span className="ov-attention-count">{count}</span>
    </li>
  );
}
