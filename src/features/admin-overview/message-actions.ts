"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { requireRole, UnauthorizedError } from "@/features/accounts/authz";
import { buildMessageDeps } from "@/features/messages/deps";
import { ConversationNotFoundError, IdempotencyKeyReusedError } from "@/features/messages/repositories/message-repository";
import { markConversationRead } from "@/features/messages/use-cases/mark-conversation-read";
import { InvalidReplyError, replyToConversation } from "@/features/messages/use-cases/reply-to-conversation";

/** `notice` is a success message that still needs the owner's attention (the email didn't go out). */
export type ReplyState = { error: string | null; notice: string | null; sent: number };

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

// Database ids (cuid) and form keys (UUID) only.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

const INVALID = "That request wasn't valid. Reload and try again.";

/**
 * The Unread Messages dialog's Reply: stores the owner's reply and emails
 * the customer, once (the idempotency key was made when the form rendered,
 * ADR-0012). If the email can't be sent the reply is still saved, and the
 * owner is told. The admin check comes before anything is read.
 */
export async function replyToConversationAction(previous: ReplyState, formData: FormData): Promise<ReplyState> {
  const conversationId = text(formData, "conversationId");
  const idempotencyKey = text(formData, "idempotencyKey");
  const body = text(formData, "body");

  try {
    const actingUser = await actingUserFromCookies(await cookies());
    requireRole(actingUser, "ADMIN");
    if (!ID_PATTERN.test(conversationId) || !KEY_PATTERN.test(idempotencyKey)) return { ...previous, error: INVALID, notice: null };
    const result = await replyToConversation(buildMessageDeps(), actingUser, { conversationId, body, idempotencyKey });
    revalidatePath("/admin");
    const sent = previous.sent + 1;
    if (result.status === "sent" && result.emailFailed) {
      return { error: null, notice: "Your reply is saved, but the email didn't go out. Contact the customer yourself.", sent };
    }
    return { error: null, notice: result.status === "sent" ? "Reply sent." : "That reply was already sent.", sent };
  } catch (err) {
    if (err instanceof InvalidReplyError) return { ...previous, error: err.message, notice: null };
    if (err instanceof IdempotencyKeyReusedError) return { ...previous, error: INVALID, notice: null };
    if (err instanceof ConversationNotFoundError) return { ...previous, error: "This conversation no longer exists.", notice: null };
    if (err instanceof UnauthorizedError) return { ...previous, error: "You need to be signed in as an admin to do that.", notice: null };
    throw err;
  }
}

/** The dialog's Mark read: sets readAt where it's still null, so a repeat is a no-op. */
export async function markConversationReadAction(formData: FormData): Promise<void> {
  const conversationId = text(formData, "conversationId");
  const actingUser = await actingUserFromCookies(await cookies());
  requireRole(actingUser, "ADMIN");
  if (!ID_PATTERN.test(conversationId)) return;
  await markConversationRead(buildMessageDeps(), actingUser, { conversationId });
  revalidatePath("/admin");
}
