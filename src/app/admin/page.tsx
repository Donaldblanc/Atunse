// The admin Overview, from the admin design (scratch/overview-dashboard.jpeg).
// Reachable only past src/proxy.ts's admin guard and the admin layout's
// own check; getAdminOverview checks the role again itself (ADR-0012).
//
// Booked orders and revenue follow the range picker; the work queues,
// Recent Orders and Today's Schedule are always "right now". Sections
// whose data doesn't exist yet (unread messages, low stock, reviews) show
// sample data from sample-data.ts, tagged "Sample" on the page and tracked
// in docs/TODO.md until real data replaces it.
import {
  ArrowRightIcon,
  ChartBarIcon,
  ChatCenteredTextIcon,
  ClipboardTextIcon,
  CreditCardIcon,
  PackageIcon,
  StarIcon,
  TruckIcon,
  WarningIcon,
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
import { RecentOrders } from "@/features/admin-overview/recent-orders";
import { RevenueTrend } from "@/features/admin-overview/revenue-trend";
import { SAMPLE_LOW_STOCK_ITEMS, SAMPLE_REVIEWS, SAMPLE_UNREAD_MESSAGES, type SampleReview } from "@/features/admin-overview/sample-data";
import { getScheduledVisit } from "@/features/admin-overview/scheduled-visit";
import { ServicesDonut } from "@/features/admin-overview/services-donut";
import { TodaysSchedule } from "@/features/admin-overview/todays-schedule";
import { buildVisitDeps } from "@/features/admin-overview/visit-deps";
import { VisitDialog } from "@/features/admin-overview/visit-dialog";
import { calendarDateInShopTime, calendarDateToUtcMidnight } from "@/features/orders/calendar-date";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/features/orders/domain";
import type { AwaitingDeposits } from "@/features/orders/repositories/order-repository";
import { builtScreenHref, OWNER_DISPLAY_NAME } from "./admin-screens";

export const metadata = { title: "Overview · Atunṣe Admin" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AdminOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rangeId = parseOverviewRangeId(params.range);
  const actingUser = await actingUserFromCookies(await cookies());
  const deps = buildAdminOverviewDeps();
  const overview = await getAdminOverview(deps, actingUser, rangeId);
  // The Schedule Item dialog is open while `?visit=` names an Appointment.
  const visitId = typeof params.visit === "string" ? params.visit : null;
  const visit = visitId ? await getScheduledVisit(buildVisitDeps(), actingUser, visitId) : null;
  const { range } = overview;

  const today = calendarDateInShopTime(deps.now());
  const highlight = range.days.includes(today) ? today : range.days[range.days.length - 1]!;
  const ordersHref = builtScreenHref("orders");
  const calendarHref = builtScreenHref("calendar");

  return (
    <div className="ov">
      {visitId && <VisitDialog visit={visit} searchParams={params} />}
      <div className="ov-primary">
        <div className="ov-header">
          <div>
            <p className="ov-eyebrow">Welcome back</p>
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
          <StatCard label="Booked Revenue" icon={ChartBarIcon} value={overview.bookedRevenue.current.format()}>
            <Delta
              current={overview.bookedRevenue.current.cents}
              previous={overview.bookedRevenue.previous.cents}
              comparison={range.comparisonLabel}
            />
          </StatCard>
          <StatCard label="Pending Payments" icon={CreditCardIcon} value={String(overview.awaitingDeposit.orders)}>
            <p className="ov-stat-note">
              {overview.awaitingDeposit.orders === 0 ? "Every deposit confirmed" : depositSplit(overview.awaitingDeposit)}
            </p>
          </StatCard>
          <StatCard label="Ready to Return" icon={TruckIcon} value={String(overview.readyForReturn)}>
            {ordersHref ? (
              <Link className="ov-stat-link" href={`${ordersHref}?status=READY_FOR_PICKUP_SHIPPING`}>
                View orders <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
              </Link>
            ) : (
              <p className="ov-stat-note">Ready for Drop-Off/Shipping</p>
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

        <section className="ov-card" aria-labelledby="ov-recent-title">
          <div className="ov-card-head">
            <h2 id="ov-recent-title" className="ov-card-title">
              Recent Orders
            </h2>
            {ordersHref && <CardLink href={ordersHref}>View all orders</CardLink>}
          </div>
          <RecentOrders orders={overview.recentOrders} />
        </section>
      </div>

      <aside className="ov-secondary" aria-label="Today">
        <BrandCard />

        <section className="ov-card" aria-labelledby="ov-schedule-title">
          <div className="ov-card-head">
            <h2 id="ov-schedule-title" className="ov-card-title">
              Today&apos;s Schedule
            </h2>
            {calendarHref && <CardLink href={calendarHref}>View calendar</CardLink>}
          </div>
          <TodaysSchedule visits={overview.todaysSchedule} searchParams={params} />
        </section>

        <section className="ov-card" aria-labelledby="ov-attention-title">
          <h2 id="ov-attention-title" className="ov-card-title">
            Needs Attention
          </h2>
          <ul className="ov-attention">
            <AttentionItem tone="red" icon={CreditCardIcon} title="Pending Payments" detail="Awaiting customer deposit" count={overview.awaitingDeposit.orders} />
            <AttentionItem tone="orange" icon={PackageIcon} title="Ready to Return" detail="Completed and ready to go back" count={overview.readyForReturn} />
            <AttentionItem tone="blue" icon={ClipboardTextIcon} title="Needs a Quote" detail="Pairs waiting on your review" count={overview.needsQuote} />
            <AttentionItem tone="violet" icon={ChatCenteredTextIcon} title="Unread Messages" detail="Customer inquiries" count={SAMPLE_UNREAD_MESSAGES} sample />
            <AttentionItem tone="gray" icon={WarningIcon} title="Low Stock Items" detail="Restock soon" count={SAMPLE_LOW_STOCK_ITEMS} sample />
          </ul>
        </section>

        <section className="ov-card" aria-labelledby="ov-reviews-title">
          <div className="ov-card-head">
            <h2 id="ov-reviews-title" className="ov-card-title">
              Recent Reviews
            </h2>
            <SampleTag />
          </div>
          <ul className="ov-reviews">
            {SAMPLE_REVIEWS.map((review) => (
              <Review key={`${review.name}-${review.date}`} review={review} />
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

/** "3 Zelle · 3 Cash · $280 due": each method that has a Deposit waiting, then the total. */
function depositSplit({ byMethod, deposits }: AwaitingDeposits): string {
  const methods = PAYMENT_METHODS.filter((method) => byMethod[method] > 0).map((method) => `${byMethod[method]} ${PAYMENT_METHOD_LABELS[method]}`);
  return [...methods, `${deposits.format()} due`].join(" · ");
}

function StatCard({ label, icon: Icon, value, children }: { label: string; icon: Icon; value: string; children: React.ReactNode }) {
  return (
    <div className="ov-card ov-stat">
      <div className="ov-stat-head">
        <h2 className="ov-stat-label">{label}</h2>
        <Icon size={26} weight="light" className="ov-stat-icon" aria-hidden="true" />
      </div>
      <p className="ov-stat-value">{value}</p>
      {children}
    </div>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="ov-card-link" href={href}>
      {children} <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
    </Link>
  );
}

/** The design's brand panel: the wordmark and tagline beside a restored pair. Decorative. */
function BrandCard() {
  return (
    <div className="ov-brand" aria-hidden="true">
      <div className="ov-brand-text">
        <span className="ov-brand-name">ATUNṢE</span>
        <span className="ov-brand-tag">
          Restore more
          <br />
          than sneakers.
          <br />
          Restore the feeling.
        </span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a small decorative crop, not worth next/image's loader */}
      <img src="/images/admin/brand-sneaker.jpg" alt="" className="ov-brand-photo" />
    </div>
  );
}

/** Marks sample data (sample-data.ts) so nobody reads it as real. */
function SampleTag() {
  return (
    <span className="ov-sample" title="Sample data: the real figure arrives with its screen (docs/TODO.md)">
      Sample
    </span>
  );
}

function AttentionItem({
  tone,
  icon: Icon,
  title,
  detail,
  count,
  sample = false,
}: {
  tone: "red" | "orange" | "blue" | "violet" | "gray";
  icon: Icon;
  title: string;
  detail: string;
  count: number;
  /** The count is sample data, not real. */
  sample?: boolean;
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
      {sample && <SampleTag />}
      <span className="ov-attention-count" data-alert={tone === "red" && count > 0 ? "true" : undefined}>
        {count}
      </span>
    </li>
  );
}

const reviewDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function Review({ review }: { review: SampleReview }) {
  const initials = review.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <li className="ov-review">
      <span className="ov-review-avatar" aria-hidden="true">
        {initials}
      </span>
      <div className="ov-review-body">
        <div className="ov-review-head">
          <strong>{review.name}</strong>
          <span className="ov-cell-sub">{reviewDay.format(calendarDateToUtcMidnight(review.date))}</span>
        </div>
        <span className="ov-stars" role="img" aria-label={`${review.rating} out of 5 stars`}>
          {Array.from({ length: 5 }, (_, i) => (
            <StarIcon key={i} size={18} weight={i < review.rating ? "fill" : "regular"} aria-hidden="true" />
          ))}
        </span>
        <p className="ov-review-text">{review.text}</p>
      </div>
    </li>
  );
}
