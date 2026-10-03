import { AllOrdersDialog } from "../all-orders-dialog";
import { buildFindOrdersDeps } from "../find-orders-deps";
import { ordersFilterLabel } from "../chart-links";
import { formatRangeDates, overviewRange } from "../overview-range";
import { parseOrdersQuery, searchOrders } from "../search-orders";
import type { OverviewDialogContext, OverviewParams } from "./overview-dialog-context";

export const matchesAllOrders = (params: OverviewParams) => params.orders === "all";

export async function AllOrdersSlot({ params, selection, actingUser, now }: OverviewDialogContext) {
  const range = overviewRange(selection, now);
  const list = await searchOrders(buildFindOrdersDeps(), actingUser, parseOrdersQuery(params), range);
  return <AllOrdersDialog list={list} selection={selection} filterLabel={ordersFilterLabel(list.query, formatRangeDates(range))} />;
}
