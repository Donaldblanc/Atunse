"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { requireRole, UnauthorizedError } from "@/features/accounts/authz";
import { buildOrderUseCaseDeps } from "@/features/orders/deps";
import {
  AppointmentMovedError,
  AppointmentNotFoundError,
  AppointmentNotScheduledError,
  OrderNotFoundError,
  ReturnAlreadyBookedError,
} from "@/features/orders/repositories/order-repository";
import { bookReturnVisit, ReturnNotAvailableError } from "@/features/orders/use-cases/book-return-visit";
import { rescheduleVisit } from "@/features/orders/use-cases/reschedule-visit";
import { VisitSlotError } from "@/features/orders/visit-slot";
import { overviewHref, parseOverviewSelection } from "./overview-range";

export type ScheduleVisitState = {
  error: string | null;
  /** Set when the change was saved but the customer's email failed: the owner should tell them directly. */
  warning?: string;
  /** Where "Done" goes after such a warning. */
  doneHref?: string;
};

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** The range params ride along as hidden fields, parsed like the page's own so the redirect stays a valid /admin URL. */
function selectionFrom(formData: FormData) {
  return parseOverviewSelection({ range: field(formData, "range") || undefined, from: field(formData, "from") || undefined, to: field(formData, "to") || undefined }, new Date());
}

/** A message for the errors an owner can cause or race into; anything else is a real failure and rethrows. */
function messageFor(err: unknown): string {
  if (err instanceof VisitSlotError || err instanceof ReturnNotAvailableError || err instanceof AppointmentMovedError) return err.message;
  if (err instanceof AppointmentNotScheduledError) return `This visit is already ${err.status === "COMPLETED" ? "completed" : "cancelled"}, so it can't be moved.`;
  if (err instanceof AppointmentNotFoundError) return "This visit no longer exists.";
  if (err instanceof OrderNotFoundError) return "This order no longer exists.";
  if (err instanceof ReturnAlreadyBookedError) return "A return visit is already booked for this order. Reload to see it.";
  if (err instanceof UnauthorizedError) return "You need to be signed in as an admin to do that.";
  throw err;
}

/**
 * The Schedule Item dialog's Reschedule, after the owner confirmed the
 * email to the customer. `expectedStartsAt` is the time the owner saw, the
 * use-case's idempotency guard (see rescheduleVisit). On success it goes
 * back to the visit's dialog, which now shows the new time.
 */
export async function rescheduleVisitAction(_previous: ScheduleVisitState, formData: FormData): Promise<ScheduleVisitState> {
  const appointmentId = field(formData, "appointmentId");
  const expectedStartsAt = new Date(field(formData, "expectedStartsAt"));
  const selection = selectionFrom(formData);
  if (!appointmentId || Number.isNaN(expectedStartsAt.getTime())) return { error: "That request wasn't valid. Reload and try again." };

  const doneHref = overviewHref(selection, { visit: appointmentId });
  let warning: string | null = null;
  try {
    const actingUser = await actingUserFromCookies(await cookies());
    requireRole(actingUser, "ADMIN");
    const result = await rescheduleVisit({ ...buildOrderUseCaseDeps(), now: () => new Date() }, actingUser, {
      appointmentId,
      expectedStartsAt,
      date: field(formData, "date"),
      slot: field(formData, "slot"),
    });
    if (result.changed && !result.emailed) warning = "The visit was moved, but the email to the customer didn't send. Please let them know the new time yourself.";
  } catch (err) {
    return { error: messageFor(err) };
  }
  revalidatePath("/admin");
  if (warning) return { error: null, warning, doneHref };
  // redirect() throws, so it stays outside the try.
  redirect(doneHref);
}

/** "Book return visit" from the Order dialog or Ready to Return, after the owner confirmed the email. */
export async function bookReturnVisitAction(_previous: ScheduleVisitState, formData: FormData): Promise<ScheduleVisitState> {
  const orderId = field(formData, "orderId");
  const selection = selectionFrom(formData);
  if (!orderId) return { error: "That request wasn't valid. Reload and try again." };

  let doneHref = "";
  let warning: string | null = null;
  try {
    const actingUser = await actingUserFromCookies(await cookies());
    requireRole(actingUser, "ADMIN");
    const result = await bookReturnVisit({ ...buildOrderUseCaseDeps(), now: () => new Date() }, actingUser, {
      orderId,
      date: field(formData, "date"),
      slot: field(formData, "slot"),
    });
    // Land on the new visit's dialog so the owner sees it on the Calendar's terms.
    doneHref = overviewHref(selection, { visit: result.appointment.id });
    if (result.created && !result.emailed) warning = "The return visit was booked, but the email to the customer didn't send. Please let them know the time yourself.";
  } catch (err) {
    return { error: messageFor(err) };
  }
  revalidatePath("/admin");
  if (warning) return { error: null, warning, doneHref };
  redirect(doneHref);
}
