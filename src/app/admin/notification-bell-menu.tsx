"use client";

import { BellIcon } from "@phosphor-icons/react/dist/ssr";
import { useId } from "react";
import { markAllNotificationsReadAction, openNotificationAction } from "@/features/admin-overview/notification-actions";
import { usePopover } from "@/shared/ui/use-popover";

export interface BellItem {
  id: string;
  title: string;
  body: string | null;
  orderId: string | null;
  unread: boolean;
  /** Already formatted on the server ("5 min ago"), so hydration can't disagree. */
  when: string;
}

/** The bell button and its popover of the 10 latest notifications. Each item is a form: it marks itself read, then opens its Order. */
export function NotificationBellMenu({ items, unreadCount }: { items: BellItem[]; unreadCount: number }) {
  const { open, toggle, rootRef } = usePopover<HTMLDivElement>();
  const panelId = useId();
  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications";

  return (
    <div className="admin-bell" ref={rootRef}>
      <button type="button" className="admin-bell-button" aria-label={label} aria-expanded={open} aria-controls={panelId} onClick={toggle}>
        <BellIcon size={22} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="admin-bell-badge" aria-hidden="true">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      <div id={panelId} className="admin-popover admin-bell-panel" hidden={!open}>
        <div className="admin-bell-head">
          <strong>Notifications</strong>
          {unreadCount > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <button type="submit" className="admin-bell-markall">
                Mark all read
              </button>
            </form>
          ) : null}
        </div>
        {items.length === 0 ? (
          <p className="admin-bell-empty">No notifications yet.</p>
        ) : (
          <ul className="admin-bell-list">
            {items.map((item) => (
              <li key={item.id}>
                <form action={openNotificationAction}>
                  <input type="hidden" name="notificationId" value={item.id} />
                  <input type="hidden" name="orderId" value={item.orderId ?? ""} />
                  <button type="submit" className="admin-bell-item" data-unread={item.unread}>
                    <span className="admin-bell-dot" aria-hidden="true" />
                    <span className="admin-bell-text">
                      <strong>{item.title}</strong>
                      {item.body ? <span>{item.body}</span> : null}
                      <time className="admin-bell-when">{item.when}</time>
                    </span>
                    {item.unread ? <span className="sr-only">Unread</span> : null}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
