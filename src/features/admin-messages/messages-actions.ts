"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { requireRole, UnauthorizedError } from "@/features/accounts/authz";
import { buildMessageDeps } from "@/features/messages/deps";
import { setConversationArchived } from "@/features/messages/use-cases/set-conversation-archived";
import { CustomerNotFoundError, InvalidMessageError, startConversation } from "@/features/messages/use-cases/start-conversation";

/** `New Message`'s result: an error keeps the dialog open with what was typed. */
export type StartConversationState = { error: string | null };

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
  await setConversationArchived(buildMessageDeps(), actingUser, { conversationId, archived });
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
  try {
    const actingUser = await actingUserFromCookies(await cookies());
    requireRole(actingUser, "ADMIN");
    if (!KEY_PATTERN.test(idempotencyKey)) return { error: INVALID };
    const result = await startConversation(buildMessageDeps(), actingUser, { customerEmail, subject: subject || null, body, idempotencyKey });
    conversationId = result.conversationId;
  } catch (err) {
    if (err instanceof InvalidMessageError) return { error: err.message };
    if (err instanceof CustomerNotFoundError) return { error: "No customer account has that email." };
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that." };
    throw err;
  }
  revalidatePath("/admin/messages");
  redirect(`/admin/messages?c=${encodeURIComponent(conversationId)}`);
}
