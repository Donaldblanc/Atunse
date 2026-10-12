import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { ConversationThread, MessageRepository } from "../repositories/message-repository";

/** The Messages screen's thread view: one Conversation's whole thread, or null for an id none has. Admin-only. */
export async function getConversationThread(
  deps: { messages: Pick<MessageRepository, "getConversationThread"> },
  actingUser: ActingUser,
  conversationId: string,
): Promise<ConversationThread | null> {
  requireRole(actingUser, "ADMIN");
  return deps.messages.getConversationThread(conversationId);
}
