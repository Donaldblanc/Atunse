"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { AppointmentCancelledError, AppointmentNotFoundError } from "@/features/orders/repositories/order-repository";
import { completeAppointment } from "./complete-appointment";
import { overviewHref, parseOverviewSelection } from "./overview-range";
import { buildVisitDeps } from "./visit-deps";

/**
 * The Schedule Item dialog's "Mark as Completed". Completing drops the
 * visit out of Today's Schedule, so the dialog closes (back to the
 * Overview with the same range). If the visit was cancelled or removed
 * meanwhile, it reloads the dialog instead, which then shows what is true
 * now. The range params come back as hidden fields so the redirect keeps them.
 */
export async function completeVisitAction(formData: FormData): Promise<void> {
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };
  const appointmentId = field("appointmentId") ?? "";
  // Parsed like the page's own params, so the redirect only ever goes to a valid /admin URL.
  const selection = parseOverviewSelection({ range: field("range"), from: field("from"), to: field("to") }, new Date());

  const actingUser = await actingUserFromCookies(await cookies());
  let stale = false;
  try {
    await completeAppointment(buildVisitDeps(), actingUser, { appointmentId });
  } catch (err) {
    if (!(err instanceof AppointmentCancelledError || err instanceof AppointmentNotFoundError)) throw err;
    stale = true;
  }

  revalidatePath("/admin");
  // redirect() throws, so it stays outside the try.
  redirect(overviewHref(selection, stale ? { visit: appointmentId } : {}));
}
