import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { MessageRepository } from "../repositories/message-repository";

/**
 * The Messages screen's Archive / Unarchive. It only sets archivedAt, so a
 * repeat is a no-op (no idempotency key needed). Admin-only.
 */
export async function setConversationArchived(
  deps: { messages: Pick<MessageRepository, "setConversationArchived">; now: () => Date },
  actingUser: ActingUser,
  input: { conversationId: string; archived: boolean },
): Promise<void> {
  requireRole(actingUser, "ADMIN");
  await deps.messages.setConversationArchived(input.conversationId, input.archived, deps.now());
}
