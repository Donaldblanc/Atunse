import Link from "next/link";
import { randomUUID } from "node:crypto";
import { SHOP_TIMEZONE } from "@/features/orders/calendar-date";
import type { ConversationThread } from "@/features/messages/repositories/message-repository";
import { MessageReplyForm } from "@/features/admin-overview/message-reply-form";
import { setConversationArchivedAction } from "./messages-actions";

const stamp = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: SHOP_TIMEZONE });

/** The Messages screen's middle column: the open Conversation's thread and reply form. */
export function ThreadView({ thread }: { thread: ConversationThread }) {
  return (
    <div className="am-thread">
      <div className="am-thread-head">
        <div>
          <strong>{thread.customerName ?? thread.customerEmail}</strong>
          <p className="am-thread-contact">{thread.customerEmail}</p>
        </div>
        <div className="am-thread-actions">
          <Link href={`/admin/customers/${thread.accountId}`} className="att-link">
            View Customer →
          </Link>
          <form action={setConversationArchivedAction}>
            <input type="hidden" name="conversationId" value={thread.conversationId} />
            <input type="hidden" name="archived" value={thread.archivedAt ? "false" : "true"} />
            <button type="submit" className="admin-btn" data-variant="secondary">
              {thread.archivedAt ? "Unarchive" : "Archive"}
            </button>
          </form>
        </div>
      </div>

      {thread.messages.length === 0 ? (
        <p className="ov-empty">No messages yet.</p>
      ) : (
        <ol className="am-bubbles">
          {thread.messages.map((m) => (
            <li key={m.id} className="msg-bubble" data-author={m.author} data-unread={m.author === "CUSTOMER" && !m.readAt ? "true" : undefined}>
              <p className="msg-meta">
                {m.author === "ADMIN" ? "You" : (thread.customerName ?? "Customer")} · {stamp.format(m.createdAt)}
              </p>
              <p className="msg-body">{m.body}</p>
            </li>
          ))}
        </ol>
      )}

      <MessageReplyForm conversationId={thread.conversationId} initialKey={randomUUID()} />
    </div>
  );
}
