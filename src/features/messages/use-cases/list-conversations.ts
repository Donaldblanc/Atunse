import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { ConversationFilter, ConversationSummary, MessageRepository } from "../repositories/message-repository";

/** The Messages screen's list (`/admin/messages`): every Conversation matching the filter. Admin-only. */
export async function listConversations(
  deps: { messages: Pick<MessageRepository, "listConversations"> },
  actingUser: ActingUser,
  filter: ConversationFilter,
): Promise<ConversationSummary[]> {
  requireRole(actingUser, "ADMIN");
  return deps.messages.listConversations(filter);
}
