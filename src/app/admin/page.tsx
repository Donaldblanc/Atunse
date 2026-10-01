// The admin Overview, from the admin design (scratch/overview-dashboard.jpeg).
// Reachable only past src/proxy.ts's admin guard and the admin layout's
// own check; getAdminOverview checks the role again itself (ADR-0012).
//
// Booked orders and revenue follow the range picker; the work queues,
// Recent Orders and Today's Schedule are always "right now".

import { cookies } from "next/headers";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { OverviewDialogs } from "@/features/admin-overview/dialogs/registry";
import { buildAdminOverviewDeps } from "@/features/admin-overview/deps";
import { getAdminOverview } from "@/features/admin-overview/get-admin-overview";
import { overviewHref, parseOverviewSelection } from "@/features/admin-overview/overview-range";
import { OverviewPanels } from "@/features/admin-overview/panels/overview-panels";

export const metadata = { title: "Overview · Atunṣe Admin" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AdminOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actingUser = await actingUserFromCookies(await cookies());
  const deps = buildAdminOverviewDeps();
  const now = deps.now();
  // ?range= (a preset) or ?from=&to= (custom); links that add their own
  // params build on overviewHref(selection, {...}) to keep it.
  const selection = parseOverviewSelection(params, now);
  // At most one dialog is open over the Overview, named by its param
  // (?metric=, ?order=, ...); closing it goes back to the bare range.
  const closeHref = overviewHref(selection);
  // Started here, not awaited: the panels and the dialog slots render
  // concurrently, so a dialog's own load runs beside the overview's.
  const overview = getAdminOverview(deps, actingUser, selection);

  return (
    <div className="ov">
      <OverviewPanels overview={overview} selection={selection} now={now} />
      {/* A modal <dialog> sits in the top layer, so it doesn't take part in this grid. */}
      <OverviewDialogs ctx={{ params, selection, actingUser, overview, closeHref, now }} />
    </div>
  );
}
