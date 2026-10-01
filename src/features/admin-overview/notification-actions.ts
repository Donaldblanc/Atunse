"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { requireRole } from "@/features/accounts/authz";
import { buildOrderUseCaseDeps } from "@/features/orders/deps";
import { markNotificationsRead } from "./mark-notifications-read";

// Marking read only sets readAt where it's still null, so a repeat is a
// no-op: no idempotency key is needed.

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

// A database id (cuid): the only thing allowed into the redirect URL.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** One bell item: marks it read, then opens its Order's dialog (/admin?order=). */
export async function openNotificationAction(formData: FormData): Promise<void> {
  const id = text(formData, "notificationId");
  const orderId = text(formData, "orderId");

  const actingUser = await actingUserFromCookies(await cookies());
  requireRole(actingUser, "ADMIN");
  if (!ID_PATTERN.test(id)) redirect("/admin");
  await markNotificationsRead(buildOrderUseCaseDeps(), actingUser, { ids: [id] });

  revalidatePath("/admin");
  redirect(ID_PATTERN.test(orderId) ? `/admin?order=${encodeURIComponent(orderId)}` : "/admin");
}

/** The bell's "Mark all read". */
export async function markAllNotificationsReadAction(): Promise<void> {
  const actingUser = await actingUserFromCookies(await cookies());
  requireRole(actingUser, "ADMIN");
  await markNotificationsRead(buildOrderUseCaseDeps(), actingUser, { all: true });
  revalidatePath("/admin");
}
