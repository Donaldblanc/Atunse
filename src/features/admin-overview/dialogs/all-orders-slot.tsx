import { AllOrdersDialog } from "../all-orders-dialog";
import { buildFindOrdersDeps } from "../find-orders-deps";
import { parseOrdersQuery, searchOrders } from "../search-orders";
import type { OverviewDialogContext, OverviewParams } from "./overview-dialog-context";

export const matchesAllOrders = (params: OverviewParams) => params.orders === "all";

export async function AllOrdersSlot({ params, selection, actingUser }: OverviewDialogContext) {
  const list = await searchOrders(buildFindOrdersDeps(), actingUser, parseOrdersQuery(params));
  return <AllOrdersDialog list={list} selection={selection} />;
}
