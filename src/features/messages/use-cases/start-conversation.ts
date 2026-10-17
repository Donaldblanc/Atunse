import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { AccountRepository } from "@/features/accounts/repositories/account-repository";
import type { NotificationService } from "@/features/notifications/notification-service";
import { redactForLog } from "@/shared/logging/redact";
import { REPLY_MAX_LENGTH } from "../reply-limits";
import type { MessageRepository } from "../repositories/message-repository";

export class InvalidMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMessageError";
  }
}

export class CustomerNotFoundError extends Error {
  constructor() {
    super("No customer account has that email");
    this.name = "CustomerNotFoundError";
  }
}

/**
 * The Messages screen's New Message: starts a Conversation with an existing
 * Customer Account and stores its first (ADMIN-authored) Message. Admin-only.
 * Then it emails the Customer the Message (plain text). Idempotent on
 * `idempotencyKey` (ADR-0012): a replay creates nothing, sends no second
 * email and returns the Conversation the first call made. A failed send
 * doesn't undo the stored Message; `emailFailed` says so.
 */
export async function startConversation(
  deps: {
    messages: Pick<MessageRepository, "startConversation">;
    accounts: Pick<AccountRepository, "findCustomerByEmail">;
    notifications: NotificationService;
    now: () => Date;
  },
  actingUser: ActingUser,
  input: { customerEmail: string; subject: string | null; body: string; idempotencyKey: string },
): Promise<{ conversationId: string; emailFailed: boolean }> {
  requireRole(actingUser, "ADMIN");
  if (!input.idempotencyKey) throw new InvalidMessageError("Reload and try again.");
  const body = input.body.trim();
  if (body === "") throw new InvalidMessageError("Write a message first.");
  if (body.length > REPLY_MAX_LENGTH) throw new InvalidMessageError(`Keep the message to ${REPLY_MAX_LENGTH} characters or fewer.`);
  const email = input.customerEmail.trim().toLowerCase();
  if (email === "") throw new InvalidMessageError("Enter the customer's email.");

  const account = await deps.accounts.findCustomerByEmail(email);
  if (!account) throw new CustomerNotFoundError();

  const subject = input.subject?.trim() || null;
  const { conversationId, created } = await deps.messages.startConversation({
    accountId: account.id,
    accountEmail: account.email,
    accountName: null,
    subject,
    authorAccountId: actingUser.accountId,
    body,
    idempotencyKey: input.idempotencyKey,
    at: deps.now(),
  });
  if (!created) return { conversationId, emailFailed: false };

  try {
    await deps.notifications.sendEmail({ to: account.email, subject: newMessageSubject(subject), body });
  } catch (err) {
    console.error(`[messages] message saved, but the email failed: ${redactForLog(err instanceof Error ? err.message : String(err))}`);
    return { conversationId, emailFailed: true };
  }
  return { conversationId, emailFailed: false };
}

/** A new thread's email subject: the owner's subject as typed (CR/LF collapsed so it can't add headers), not a "Re:". */
export function newMessageSubject(subject: string | null): string {
  const clean = subject?.replace(/[\r\n]+/g, " ").trim();
  return clean || "A message from Atunṣe";
}
