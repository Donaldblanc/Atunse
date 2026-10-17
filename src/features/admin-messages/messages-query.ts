import type { ConversationFilter } from "@/features/messages/repositories/message-repository";

export interface MessagesQuery {
  q: string;
  status: ConversationFilter["status"];
  channel: ConversationFilter["channel"];
  /** The open Conversation, or null when none is selected. */
  c: string | null;
  /** 1-based page of the Conversation list. */
  page: number;
}

const STATUSES: NonNullable<ConversationFilter["status"]>[] = ["all", "unread", "archived"];
const CHANNELS: NonNullable<ConversationFilter["channel"]>[] = ["all", "IN_APP", "EMAIL", "SMS"];
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function one(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

/** The Messages screen's `?q=&status=&channel=&c=`, defaulted and validated against known values. */
export function parseMessagesQuery(params: { [key: string]: string | string[] | undefined }): MessagesQuery {
  const status = one(params.status);
  const channel = one(params.channel);
  const c = one(params.c);
  return {
    q: one(params.q).slice(0, 100),
    status: STATUSES.includes(status as never) ? (status as MessagesQuery["status"]) : "all",
    channel: CHANNELS.includes(channel as never) ? (channel as MessagesQuery["channel"]) : "all",
    c: ID_PATTERN.test(c) ? c : null,
    page: /^[1-9][0-9]{0,5}$/.test(one(params.page)) ? Number(one(params.page)) : 1,
  };
}
