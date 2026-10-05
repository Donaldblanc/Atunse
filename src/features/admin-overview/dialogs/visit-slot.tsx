import { getScheduledVisit } from "../scheduled-visit";
import { buildVisitDeps } from "../visit-deps";
import { VisitDialog } from "../visit-dialog";
import { RescheduleDialog } from "../visit-schedule-dialogs";
import type { OverviewDialogContext, OverviewParams } from "./overview-dialog-context";

export const visitIdFromParams = (params: OverviewParams) => (typeof params.visit === "string" ? params.visit : null);
export const matchesVisit = (params: OverviewParams) => visitIdFromParams(params) !== null;

export async function VisitSlot({ params, selection, actingUser, now }: OverviewDialogContext) {
  const visitId = visitIdFromParams(params);
  if (!visitId) return null;
  const visit = await getScheduledVisit(buildVisitDeps(), actingUser, visitId);
  return params.reschedule === "1" && visit ? <RescheduleDialog visit={visit} selection={selection} now={now} /> : <VisitDialog visit={visit} selection={selection} />;
}
