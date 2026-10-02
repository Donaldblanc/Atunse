import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { MessageRepository, UnreadConversation } from "../repositories/message-repository";

/** The Overview's Unread Messages count. Admin-only (ADR-0012). */
export async function countUnreadMessages(deps: { messages: Pick<MessageRepository, "countUnread"> }, actingUser: ActingUser): Promise<number> {
  requireRole(actingUser, "ADMIN");
  return deps.messages.countUnread();
}

/** The Unread Messages dialog: Conversations with unread customer messages, each with its thread. Admin-only. */
export async function listUnreadConversations(
  deps: { messages: Pick<MessageRepository, "listUnreadConversations"> },
  actingUser: ActingUser,
): Promise<UnreadConversation[]> {
  requireRole(actingUser, "ADMIN");
  return deps.messages.listUnreadConversations();
}
