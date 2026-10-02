"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { UnauthorizedError } from "@/features/accounts/authz";
import type { VisitPlan } from "@/features/orders/domain";
import { AppointmentCancelledError, AppointmentNotFoundError } from "@/features/orders/repositories/order-repository";
import { completeAppointment } from "./complete-appointment";
import { overviewHref, parseOverviewSelection } from "./overview-range";
import { buildVisitDeps } from "./visit-deps";

/** What completing did to the pairs, or null before the form is submitted. */
export type CompleteVisitState = (VisitPlan & { alreadyCompleted: boolean }) | null;

/**
 * The Schedule Item dialog's "Mark as Completed". Completing also moves the
 * Order's pairs along (completeAppointment), so the dialog stays open and
 * shows who moved and who didn't, and why. If the visit was cancelled or
 * removed meanwhile, it reloads the dialog instead, which then shows what is
 * true now. A session that ended (or isn't an admin's) goes to sign-in, as
 * the admin layout does. The range params come back as hidden fields so a
 * redirect keeps them.
 */
export async function completeVisitAction(_previous: CompleteVisitState, formData: FormData): Promise<CompleteVisitState> {
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };
  const appointmentId = field("appointmentId") ?? "";
  // Parsed like the page's own params, so the redirect only ever goes to a valid /admin URL.
  const selection = parseOverviewSelection({ range: field("range"), from: field("from"), to: field("to") }, new Date());

  const actingUser = await actingUserFromCookies(await cookies());
  let result: CompleteVisitState = null;
  let stale = false;
  let signedOut = false;
  try {
    const { moves, stays, alreadyCompleted } = await completeAppointment(buildVisitDeps(), actingUser, { appointmentId });
    result = { moves, stays, alreadyCompleted };
  } catch (err) {
    if (err instanceof UnauthorizedError) signedOut = true;
    else if (err instanceof AppointmentCancelledError || err instanceof AppointmentNotFoundError) stale = true;
    else throw err;
  }
  // redirect() throws, so these stay outside the try.
  if (signedOut) redirect("/sign-in");
  if (stale) redirect(overviewHref(selection, { visit: appointmentId }));

  revalidatePath("/admin");
  return result;
}
