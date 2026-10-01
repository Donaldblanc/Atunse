import { calendarDateInShopTime } from "@/features/orders/calendar-date";
import { builtScreenHref, OWNER_DISPLAY_NAME } from "@/app/admin/admin-screens";
import type { AdminOverview } from "../get-admin-overview";
import { greeting } from "../greeting";
import { highlightDay } from "../highlight-day";
import { formatRangeDates, type OverviewSelection } from "../overview-range";
import { RangePicker } from "../range-picker";
import { AttentionCard } from "./attention-card";
import { BrandCard } from "./brand-card";
import { RecentOrdersCard } from "./recent-orders-card";
import { ReviewsCard } from "./reviews-card";
import { RevenueTrendCard } from "./revenue-trend-card";
import { ScheduleCard } from "./schedule-card";
import { ServicesCard } from "./services-card";
import { StatsRow } from "./stats-row";

/** Every panel (the grid's two columns). Awaits the overview itself so the dialogs can load beside it. */
export async function OverviewPanels({ overview: overviewPromise, selection, now }: { overview: Promise<AdminOverview>; selection: OverviewSelection; now: Date }) {
  const overview = await overviewPromise;
  const { range } = overview;
  const today = calendarDateInShopTime(now);
  const highlight = highlightDay(range, today);
  const ordersHref = builtScreenHref("orders");
  const calendarHref = builtScreenHref("calendar");

  return (
    <>
      <div className="ov-primary">
        <div className="ov-header">
          <div>
            <p className="ov-eyebrow">Welcome back</p>
            <h1 className="ov-title">
              {greeting(now)}, <span>{OWNER_DISPLAY_NAME}</span>{" "}
              <span className="ov-wave" aria-hidden="true">
                👋
              </span>
            </h1>
            <p className="ov-subtitle">Here&apos;s what&apos;s happening with your business today.</p>
          </div>
          <RangePicker selection={selection} today={today} datesLabel={formatRangeDates(range)} />
        </div>

        <StatsRow overview={overview} selection={selection} />

        <div className="ov-charts">
          <RevenueTrendCard overview={overview} highlight={highlight} />
          <ServicesCard overview={overview} />
        </div>

        <RecentOrdersCard overview={overview} selection={selection} ordersHref={ordersHref} />
      </div>

      <aside className="ov-secondary" aria-label="Today">
        <BrandCard />
        <ScheduleCard overview={overview} selection={selection} calendarHref={calendarHref} />
        <AttentionCard overview={overview} selection={selection} />
        <ReviewsCard selection={selection} />
      </aside>
    </>
  );
}
