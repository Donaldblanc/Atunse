import { randomUUID } from "node:crypto";
import Link from "next/link";
import { orderNumber } from "@/features/orders/domain";
import { SHOP_TIMEZONE } from "@/features/orders/calendar-date";
import type { UnreadConversation } from "@/features/messages/repositories/message-repository";
import { AdminDialog } from "@/shared/ui/admin-dialog";
import { markConversationReadAction } from "./message-actions";
import { MessageReplyForm } from "./message-reply-form";
import { overviewHref, type OverviewSelection } from "./overview-range";
import "./messages.css";

const stamp = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: SHOP_TIMEZONE });

/** The dialog behind Needs Attention's Unread Messages (`?attention=messages`): each unread Conversation's thread, with Mark read and Reply. */
export function MessagesDialog({ conversations, selection }: { conversations: UnreadConversation[]; selection: OverviewSelection }) {
  const unread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  return (
    <AdminDialog title={`Unread Messages (${unread})`} closeHref={overviewHref(selection)} size="lg">
      {conversations.length === 0 ? (
        <p className="ov-empty">No unread messages.</p>
      ) : (
        <ul className="msg-list">
          {conversations.map((c) => (
            <li key={c.conversationId} className="msg-conversation">
              <div className="msg-head">
                <div>
                  <strong>{c.customerName ?? c.customerEmail}</strong>
                  {c.subject && <span className="msg-subject"> · {c.subject}</span>}
                  {c.order && (
                    <>
                      {" · "}
                      <Link className="att-link" href={overviewHref(selection, { order: c.order.id })} scroll={false}>
                        {orderNumber(c.order.number)}
                      </Link>
                    </>
                  )}
                </div>
                <form action={markConversationReadAction}>
                  <input type="hidden" name="conversationId" value={c.conversationId} />
                  <button type="submit" className="admin-btn" data-variant="secondary">
                    Mark read
                  </button>
                </form>
              </div>
              <ol className="msg-thread">
                {c.messages.map((m) => (
                  <li key={m.id} className="msg-bubble" data-author={m.author} data-unread={m.author === "CUSTOMER" && !m.readAt ? "true" : undefined}>
                    <p className="msg-meta">
                      {m.author === "ADMIN" ? "You" : (c.customerName ?? "Customer")} · {stamp.format(m.createdAt)}
                    </p>
                    <p className="msg-body">{m.body}</p>
                  </li>
                ))}
              </ol>
              <MessageReplyForm conversationId={c.conversationId} initialKey={randomUUID()} />
            </li>
          ))}
        </ul>
      )}
    </AdminDialog>
  );
}
