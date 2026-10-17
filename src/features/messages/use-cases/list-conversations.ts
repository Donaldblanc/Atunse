import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { ConversationFilter, ConversationSummary, MessageRepository } from "../repositories/message-repository";

export const CONVERSATIONS_PAGE_SIZE = 25;

export interface ConversationListPage {
  conversations: ConversationSummary[];
  total: number;
  page: number;
  pageCount: number;
}

/** The Messages screen's list (`/admin/messages`): one page (1-based) of Conversations matching the filter. Admin-only. */
export async function listConversations(
  deps: { messages: Pick<MessageRepository, "listConversations"> },
  actingUser: ActingUser,
  filter: Omit<ConversationFilter, "limit" | "offset"> & { page?: number },
): Promise<ConversationListPage> {
  requireRole(actingUser, "ADMIN");
  const { page: requested, ...rest } = filter;
  const page = Math.max(1, Math.floor(requested ?? 1) || 1);
  const { conversations, total } = await deps.messages.listConversations({
    ...rest,
    limit: CONVERSATIONS_PAGE_SIZE,
    offset: (page - 1) * CONVERSATIONS_PAGE_SIZE,
  });
  return { conversations, total, page, pageCount: Math.max(1, Math.ceil(total / CONVERSATIONS_PAGE_SIZE)) };
}
