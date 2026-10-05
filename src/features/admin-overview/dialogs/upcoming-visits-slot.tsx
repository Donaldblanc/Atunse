import { buildFindOrdersDeps } from "../find-orders-deps";
import { getUpcomingVisits } from "../upcoming-visits";
import { UpcomingVisitsDialog } from "../upcoming-visits-dialog";
import type { OverviewDialogContext, OverviewParams } from "./overview-dialog-context";

export const matchesUpcomingVisits = (params: OverviewParams) => params.visits === "upcoming";

export async function UpcomingVisitsSlot({ selection, actingUser, now }: OverviewDialogContext) {
  const visits = await getUpcomingVisits(buildFindOrdersDeps(), actingUser, now);
  return <UpcomingVisitsDialog visits={visits} selection={selection} />;
}
