import { calendarDateInShopTime } from "@/features/orders/calendar-date";
import { highlightDay } from "../highlight-day";
import { parseOverviewMetric } from "../metric-detail";
import { MetricDetailDialog } from "../metric-detail-dialog";
import type { OverviewDialogContext, OverviewParams } from "./overview-dialog-context";

export const matchesMetric = (params: OverviewParams) => parseOverviewMetric(params.metric) !== null;

export async function MetricSlot({ params, overview, now, closeHref }: OverviewDialogContext) {
  const metric = parseOverviewMetric(params.metric);
  if (!metric) return null;
  const loaded = await overview;
  const through = highlightDay(loaded.range, calendarDateInShopTime(now));
  return <MetricDetailDialog metric={metric} overview={loaded} through={through} closeHref={closeHref} />;
}
