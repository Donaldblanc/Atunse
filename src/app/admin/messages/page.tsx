// The Messages screen (/admin/messages): every Conversation, search/status/
// channel filters on the left, the open thread in the middle, and its
// linked Order (when it has one) plus Customer on the right.

import Link from "next/link";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { buildAdminMessagesDeps } from "@/features/admin-messages/deps";
import { ConversationList, messagesHref } from "@/features/admin-messages/conversation-list";
import { ContextPanel } from "@/features/admin-messages/context-panel";
import { parseMessagesQuery } from "@/features/admin-messages/messages-query";
import { NewMessageForm } from "@/features/admin-messages/new-message-form";
import { ThreadView } from "@/features/admin-messages/thread-view";
import { getOrderDetail } from "@/features/admin-overview/order-detail";
import { getCustomerDetail } from "@/features/admin-customers/customer-detail";
import { getConversationThread } from "@/features/messages/use-cases/get-conversation-thread";
import { listConversations } from "@/features/messages/use-cases/list-conversations";
import { AdminDialog } from "@/shared/ui/admin-dialog";
import "@/features/admin-overview/messages.css";
import "@/features/admin-messages/messages-page.css";

export const metadata = { title: "Messages · Atunṣe Admin" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AdminMessagesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actingUser = await actingUserFromCookies(await cookies());
  const deps = buildAdminMessagesDeps();
  const query = parseMessagesQuery(params);

  const conversations = await listConversations(deps, actingUser, { search: query.q || undefined, status: query.status, channel: query.channel });
  const unreadCount = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const selectedId = query.c ?? conversations[0]?.conversationId ?? null;
  const thread = selectedId ? await getConversationThread(deps, actingUser, selectedId) : null;

  const [orderDetail, customerDetail] = thread
    ? await Promise.all([
        thread.order ? getOrderDetail(deps, actingUser, thread.order.id) : Promise.resolve(null),
        getCustomerDetail(deps, actingUser, thread.accountId),
      ])
    : [null, null];

  const baseHref = messagesHref(query);
  const composeHref = `${baseHref}${baseHref.includes("?") ? "&" : "?"}compose=1`;

  return (
    <div className="ov">
      <div className="ov-header">
        <div>
          <p className="ov-eyebrow">Messages</p>
          <h1 className="ov-title">Messages</h1>
          <p className="am-subtitle">Communicate with customers about their orders.</p>
        </div>
        <Link href={composeHref} scroll={false} className="admin-btn">
          + New Message
        </Link>
      </div>

      <div className="am-grid">
        <ConversationList conversations={conversations} unreadCount={unreadCount} query={query} />
        {thread ? <ThreadView thread={thread} /> : <div className="am-thread am-thread-empty">No conversation selected.</div>}
        {thread && customerDetail && <ContextPanel order={orderDetail} customer={customerDetail} />}
      </div>

      {params.compose === "1" && (
        <AdminDialog title="New Message" closeHref={baseHref} size="md">
          <NewMessageForm initialKey={randomUUID()} />
        </AdminDialog>
      )}
    </div>
  );
}
