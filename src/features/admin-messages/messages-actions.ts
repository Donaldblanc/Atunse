"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { requireRole, UnauthorizedError } from "@/features/accounts/authz";
import { buildMessageDeps } from "@/features/messages/deps";
import { ConversationNotFoundError } from "@/features/messages/repositories/message-repository";
import { setConversationArchived } from "@/features/messages/use-cases/set-conversation-archived";
import { CustomerNotFoundError, InvalidMessageError, startConversation } from "@/features/messages/use-cases/start-conversation";

/**
 * `New Message`'s result: an error keeps the dialog open with what was typed;
 * a notice means the Message is saved but the email didn't go out.
 */
export type StartConversationState = { error: string | null; notice: string | null };

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const INVALID = "That request wasn't valid. Reload and try again.";

/** The Messages screen's Archive / Unarchive button. */
export async function setConversationArchivedAction(formData: FormData): Promise<void> {
  const conversationId = text(formData, "conversationId");
  const archived = text(formData, "archived") === "true";
  const actingUser = await actingUserFromCookies(await cookies());
  requireRole(actingUser, "ADMIN");
  if (!ID_PATTERN.test(conversationId)) return;
  try {
    await setConversationArchived(buildMessageDeps(), actingUser, { conversationId, archived });
  } catch (err) {
    // A stale tab or unknown id: nothing to change; the refresh below shows the current list.
    if (!(err instanceof ConversationNotFoundError)) throw err;
  }
  revalidatePath("/admin/messages");
}

/**
 * The Messages screen's New Message: starts a Conversation with an existing
 * Customer Account, then sends the admin straight to its thread.
 */
export async function startConversationAction(previous: StartConversationState, formData: FormData): Promise<StartConversationState> {
  const customerEmail = text(formData, "customerEmail");
  const subject = text(formData, "subject");
  const body = text(formData, "body");
  const idempotencyKey = text(formData, "idempotencyKey");

  let conversationId: string;
  let emailFailed: boolean;
  try {
    const actingUser = await actingUserFromCookies(await cookies());
    requireRole(actingUser, "ADMIN");
    if (!KEY_PATTERN.test(idempotencyKey)) return { error: INVALID, notice: null };
    const result = await startConversation(buildMessageDeps(), actingUser, { customerEmail, subject: subject || null, body, idempotencyKey });
    conversationId = result.conversationId;
    emailFailed = result.emailFailed;
  } catch (err) {
    if (err instanceof InvalidMessageError) return { error: err.message, notice: null };
    if (err instanceof CustomerNotFoundError) return { error: "No customer account has that email.", notice: null };
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that.", notice: null };
    throw err;
  }
  revalidatePath("/admin/messages");
  if (emailFailed) {
    // Stay on the form so the owner sees this; retrying the same key won't create a second Conversation.
    return { error: null, notice: "Your message is saved, but the email didn't go out. Contact the customer yourself." };
  }
  redirect(`/admin/messages?c=${encodeURIComponent(conversationId)}`);
}
