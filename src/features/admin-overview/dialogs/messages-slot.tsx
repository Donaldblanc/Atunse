import { buildMessageDeps } from "@/features/messages/deps";
import { listUnreadConversations } from "@/features/messages/use-cases/get-unread-messages";
import { MessagesDialog } from "../messages-dialog";
import type { OverviewDialogContext, OverviewParams } from "./overview-dialog-context";

export const matchesMessages = (params: OverviewParams) => params.attention === "messages";

export async function MessagesSlot({ selection, actingUser }: OverviewDialogContext) {
  const conversations = await listUnreadConversations(buildMessageDeps(), actingUser);
  return <MessagesDialog conversations={conversations} selection={selection} />;
}
