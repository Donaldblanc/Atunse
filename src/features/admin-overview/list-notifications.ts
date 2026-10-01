import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { AdminNotification, OrderRepository } from "@/features/orders/repositories/order-repository";

export const NOTIFICATION_LIST_LIMIT = 10;

/** The admin bell: the latest notifications for every admin, and how many are unread in all. Admin-only (ADR-0012). */
export async function listNotifications(
  deps: { orders: Pick<OrderRepository, "listAdminNotifications"> },
  actingUser: ActingUser,
): Promise<{ notifications: AdminNotification[]; unreadCount: number }> {
  requireRole(actingUser, "ADMIN");
  return deps.orders.listAdminNotifications(NOTIFICATION_LIST_LIMIT);
}
