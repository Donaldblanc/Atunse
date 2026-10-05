import { cookies } from "next/headers";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { buildOrderUseCaseDeps } from "@/features/orders/deps";
import { listNotifications } from "@/features/admin-overview/list-notifications";
import { relativeTime } from "@/features/admin-overview/relative-time";
import { redactForLog } from "@/shared/logging/redact";
import { NotificationBellMenu, type BellItem } from "./notification-bell-menu";

/**
 * The admin top bar's bell: the latest notifications for every admin and
 * the unread count. A failed read shows an empty bell rather than taking
 * the whole admin shell down.
 */
export async function NotificationBell() {
  let items: BellItem[] = [];
  let unreadCount = 0;
  try {
    const actingUser = await actingUserFromCookies(await cookies());
    const result = await listNotifications(buildOrderUseCaseDeps(), actingUser);
    const now = new Date();
    unreadCount = result.unreadCount;
    items = result.notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      orderId: n.orderId,
      unread: n.readAt === null,
      when: relativeTime(n.createdAt, now),
    }));
  } catch (err) {
    console.error(`[admin] notifications failed to load: ${redactForLog(err instanceof Error ? err.message : String(err))}`);
  }
  return <NotificationBellMenu items={items} unreadCount={unreadCount} />;
}
