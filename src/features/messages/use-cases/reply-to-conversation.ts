import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { NotificationService } from "@/features/notifications/notification-service";
import { orderNumber } from "@/features/orders/domain";
import { redactForLog } from "@/shared/logging/redact";
import { REPLY_MAX_LENGTH } from "../reply-limits";
import type { MessageRepository, ReplyRecipient } from "../repositories/message-repository";

export { REPLY_MAX_LENGTH };

export class InvalidReplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReplyError";
  }
}

export type ReplyResult = { status: "sent"; emailFailed: boolean } | { status: "already-sent" };

/** References the order number when the Conversation has an Order. */
export function replySubject(recipient: Pick<ReplyRecipient, "orderNumber" | "subject">): string {
  if (recipient.orderNumber !== null) return `Re: your Atunṣe order ${orderNumber(recipient.orderNumber)}`;
  // CR/LF are collapsed so a stored subject can't add email headers.
  const subject = recipient.subject?.replace(/[\r\n]+/g, " ").trim();
  return subject ? `Re: ${subject}` : "A reply from Atunṣe";
}

/**
 * The owner's reply to a customer Conversation. In ONE repository
 * transaction it stores an ADMIN-authored EMAIL Message (the Message itself,
 * with its author, is the record) and bumps lastMessageAt; then it emails
 * the Conversation's Account. Plain text: the email adapter sends it as
 * text, not HTML, so it needs no escaping.
 *
 * Idempotent on `idempotencyKey` (ADR-0012): a replay writes nothing and
 * sends no second email. A failed send doesn't undo the stored Message; the
 * result says so, so the owner can follow up by hand. Admin-only.
 */
export async function replyToConversation(
  deps: { messages: Pick<MessageRepository, "storeAdminReply">; notifications: NotificationService; now: () => Date },
  actingUser: ActingUser,
  input: { conversationId: string; body: string; idempotencyKey: string },
): Promise<ReplyResult> {
  requireRole(actingUser, "ADMIN");
  if (!input.idempotencyKey) throw new InvalidReplyError("Reload and try again.");
  const body = input.body.trim();
  if (body === "") throw new InvalidReplyError("Write a reply first.");
  if (body.length > REPLY_MAX_LENGTH) throw new InvalidReplyError(`Keep the reply to ${REPLY_MAX_LENGTH} characters or fewer.`);

  const recipient = await deps.messages.storeAdminReply({
    conversationId: input.conversationId,
    authorAccountId: actingUser.accountId,
    body,
    idempotencyKey: input.idempotencyKey,
    at: deps.now(),
  });
  if (!recipient) return { status: "already-sent" };

  try {
    await deps.notifications.sendEmail({ to: recipient.email, subject: replySubject(recipient), body });
  } catch (err) {
    console.error(`[messages] reply saved, but the email failed: ${redactForLog(err instanceof Error ? err.message : String(err))}`);
    return { status: "sent", emailFailed: true };
  }
  return { status: "sent", emailFailed: false };
}
