import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { MessageRepository } from "../repositories/message-repository";

/**
 * Sets readAt on the Conversation's unread CUSTOMER messages. It only
 * touches rows where readAt is still null, so a repeat is a no-op (no
 * idempotency key needed). Admin-only.
 */
export async function markConversationRead(
  deps: { messages: Pick<MessageRepository, "markConversationRead">; now: () => Date },
  actingUser: ActingUser,
  input: { conversationId: string },
): Promise<{ marked: number }> {
  requireRole(actingUser, "ADMIN");
  return { marked: await deps.messages.markConversationRead(input.conversationId, deps.now()) };
}
