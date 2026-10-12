import Link from "next/link";
import { orderNumber } from "@/features/orders/domain";
import { SHOP_TIMEZONE } from "@/features/orders/calendar-date";
import type { ConversationSummary, ConversationFilter } from "@/features/messages/repositories/message-repository";
import type { MessagesQuery } from "./messages-query";

const stamp = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: SHOP_TIMEZONE });
const timeOfDay = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: SHOP_TIMEZONE });

function initials(name: string | null, email: string): string {
  const from = name ?? email;
  const parts = from.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "") : from.slice(0, 2)).toUpperCase();
}

/** "/admin/messages?..." for `overrides`, keeping the current search, status tab, channel and open Conversation unless replaced. */
export function messagesHref(query: MessagesQuery, overrides: Partial<MessagesQuery> & { c?: string | null } = {}): string {
  const next = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.status && next.status !== "all") params.set("status", next.status);
  if (next.channel && next.channel !== "all") params.set("channel", next.channel);
  if ("c" in overrides ? overrides.c : query.c) params.set("c", ("c" in overrides ? overrides.c : query.c)!);
  const search = params.toString();
  return search ? `/admin/messages?${search}` : "/admin/messages";
}

const STATUS_TABS: { id: NonNullable<ConversationFilter["status"]>; label: string }[] = [
  { id: "all", label: "All Messages" },
  { id: "unread", label: "Unread" },
  { id: "archived", label: "Archived" },
];

/** The Messages screen's left column: search, status tabs, filters and the Conversation list. */
export function ConversationList({ conversations, unreadCount, query }: { conversations: ConversationSummary[]; unreadCount: number; query: MessagesQuery }) {
  return (
    <div className="am-list">
      <nav className="att-tabs" aria-label="Conversation status">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.id}
            className="att-tab"
            href={messagesHref(query, { status: tab.id, c: null })}
            aria-current={(query.status ?? "all") === tab.id ? "page" : undefined}
          >
            {tab.id === "all" ? tab.label : `${tab.label}${tab.id === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}`}
          </Link>
        ))}
      </nav>

      <form action="/admin/messages" method="get" role="search" className="am-search">
        <label htmlFor="am-q" className="sr-only">
          Search conversations
        </label>
        <input id="am-q" name="q" type="search" className="att-search-input" maxLength={100} defaultValue={query.q} placeholder="Search conversations..." />
        {query.status && query.status !== "all" && <input type="hidden" name="status" value={query.status} />}
        <select name="channel" className="am-filter" defaultValue={query.channel ?? "all"}>
          <option value="all">All channels</option>
          <option value="IN_APP">In-app</option>
          <option value="EMAIL">Email</option>
          <option value="SMS">SMS</option>
        </select>
        <button type="submit" className="admin-btn" data-variant="secondary">
          Search
        </button>
      </form>

      {conversations.length === 0 ? (
        <p className="ov-empty">No conversations.</p>
      ) : (
        <ul className="am-conversations">
          {conversations.map((c) => (
            <li key={c.conversationId}>
              <Link href={messagesHref(query, { c: c.conversationId })} className="am-conversation" aria-current={query.c === c.conversationId ? "true" : undefined}>
                <span className="am-avatar" aria-hidden="true">
                  {initials(c.customerName, c.customerEmail)}
                </span>
                <span className="am-conversation-body">
                  <span className="am-conversation-head">
                    <strong>{c.customerName ?? c.customerEmail}</strong>
                    <span className="am-conversation-time">{c.lastMessageAt ? stamp.format(c.lastMessageAt) : ""}</span>
                  </span>
                  <span className="am-conversation-subject">{c.subject ?? "(no subject)"}</span>
                  <span className="am-conversation-preview">
                    {c.lastMessagePreview ?? "—"}
                    {c.order && <span className="am-order-tag"> · {orderNumber(c.order.number)}</span>}
                  </span>
                </span>
                {c.unreadCount > 0 && (
                  <span className="am-unread-dot" aria-label={`${c.unreadCount} unread`} title={`${c.unreadCount} unread`} />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { timeOfDay };
