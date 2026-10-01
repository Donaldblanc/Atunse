import type { ActingUser } from "@/features/accounts/authz";
import type { AdminOverview } from "../get-admin-overview";
import type { OverviewSelection } from "../overview-range";

/** The URL's search params, as Next hands them to a page. */
export type OverviewParams = { [key: string]: string | string[] | undefined };

/** What every Overview dialog slot receives; a slot loads its own data from these. */
export interface OverviewDialogContext {
  params: OverviewParams;
  selection: OverviewSelection;
  actingUser: ActingUser;
  /** Started by the page and awaited only by the slots that need it, so dialog loads run in parallel with it. */
  overview: Promise<AdminOverview>;
  /** The Overview URL without any dialog param (the range is kept). */
  closeHref: string;
  now: Date;
}
