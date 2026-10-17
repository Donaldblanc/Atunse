// Proves PrismaMessageRepository against a REAL Postgres. Run with `npm run test:integration`.

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ConversationNotFoundError, IdempotencyKeyReusedError } from "./message-repository";
import { PrismaMessageRepository } from "./prisma-message-repository";

const prisma = new PrismaClient();
const repo = new PrismaMessageRepository(prisma);
const EMAIL = "messages-it@example.com";
const T0 = new Date("2026-10-01T12:00:00Z");
const T1 = new Date("2026-10-02T12:00:00Z");

let accountId = "";

beforeEach(async () => {
  // Only conversation/message rows: Orders and the rest belong to other files.
  await prisma.messageAttachment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.account.deleteMany({ where: { email: EMAIL, role: "CUSTOMER" } });
  accountId = (await prisma.account.create({ data: { email: EMAIL, name: "Jordan", phone: "2125550142", role: "CUSTOMER" } })).id;
});

afterAll(async () => {
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.account.deleteMany({ where: { email: EMAIL, role: "CUSTOMER" } });
  await prisma.$disconnect();
});

async function conversation(data: { archivedAt?: Date; lastMessageAt?: Date } = {}) {
  return prisma.conversation.create({ data: { accountId, subject: "Time", ...data } });
}
const message = (conversationId: string, data: { author?: "CUSTOMER" | "ADMIN"; channel?: "IN_APP" | "EMAIL" | "SMS"; readAt?: Date; createdAt?: Date } = {}) =>
  prisma.message.create({ data: { conversationId, author: "CUSTOMER", body: "Hi", ...data } });

describe("unread messages", () => {
  it("counts unread CUSTOMER messages in unarchived Conversations only", async () => {
    const open = await conversation();
    const archived = await conversation({ archivedAt: T0 });
    await message(open.id);
    await message(open.id);
    await message(open.id, { readAt: T0 });
    await message(open.id, { author: "ADMIN" });
    await message(archived.id);
    expect(await repo.countUnread()).toBe(2);
  });

  it("lists unread Conversations latest first, each thread oldest first", async () => {
    const older = await conversation({ lastMessageAt: T0 });
    const newer = await conversation({ lastMessageAt: T1 });
    const allRead = await conversation({ lastMessageAt: T1 });
    await message(older.id, { createdAt: T0 });
    await message(newer.id, { createdAt: T1 });
    await prisma.message.create({ data: { conversationId: newer.id, author: "ADMIN", body: "First", createdAt: T0 } });
    await message(allRead.id, { readAt: T0 });

    const list = await repo.listUnreadConversations();
    expect(list.map((c) => c.conversationId)).toEqual([newer.id, older.id]);
    expect(list[0]).toMatchObject({ unreadCount: 1, customerEmail: EMAIL, customerName: "Jordan", order: null });
    expect(list[0]!.messages.map((m) => m.body)).toEqual(["First", "Hi"]);
  });
});

describe("markConversationRead", () => {
  it("reads only that Conversation's unread CUSTOMER messages", async () => {
    const a = await conversation();
    const b = await conversation();
    await message(a.id);
    await message(a.id, { author: "ADMIN" });
    await message(b.id);
    expect(await repo.markConversationRead(a.id, T1)).toBe(1);
    expect(await repo.markConversationRead(a.id, T1)).toBe(0);
    expect(await prisma.message.count({ where: { conversationId: a.id, author: "CUSTOMER", readAt: T1 } })).toBe(1);
    expect(await prisma.message.count({ where: { conversationId: a.id, author: "ADMIN", readAt: null } })).toBe(1);
    expect(await repo.countUnread()).toBe(1);
  });
});

describe("storeAdminReply", () => {
  const reply = (conversationId: string, idempotencyKey = "key-1") => ({ conversationId, authorAccountId: null, body: "On its way.", idempotencyKey, at: T1 });

  it("stores an ADMIN EMAIL message, bumps lastMessageAt and returns the recipient", async () => {
    const c = await conversation({ lastMessageAt: T0 });
    expect(await repo.storeAdminReply(reply(c.id))).toEqual({ email: EMAIL, orderNumber: null, subject: "Time" });
    expect(await prisma.message.findFirstOrThrow({ where: { conversationId: c.id } })).toMatchObject({ author: "ADMIN", channel: "EMAIL", body: "On its way.", idempotencyKey: "key-1", createdAt: T1 });
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: c.id } })).lastMessageAt).toEqual(T1);
  });

  it("a replay writes nothing, even racing", async () => {
    const c = await conversation({ lastMessageAt: T0 });
    const results = await Promise.all([repo.storeAdminReply(reply(c.id)), repo.storeAdminReply(reply(c.id))]);
    expect(results.filter((r) => r !== null)).toHaveLength(1);
    expect(await repo.storeAdminReply(reply(c.id))).toBeNull();
    expect(await prisma.message.count({ where: { conversationId: c.id } })).toBe(1);
  });

  it("refuses a key already used in a different Conversation", async () => {
    const a = await conversation();
    const b = await conversation();
    await repo.storeAdminReply(reply(a.id));
    await expect(repo.storeAdminReply(reply(b.id))).rejects.toThrow(IdempotencyKeyReusedError);
    expect(await prisma.message.count({ where: { conversationId: b.id } })).toBe(0);
  });

  it("throws for an unknown Conversation and writes nothing", async () => {
    await expect(repo.storeAdminReply(reply("nope"))).rejects.toThrow(ConversationNotFoundError);
    expect(await prisma.message.count()).toBe(0);
  });
});

describe("listConversations", () => {
  it("defaults to the inbox (not archived), newest activity first", async () => {
    const newer = await conversation({ lastMessageAt: T1 });
    const older = await conversation({ lastMessageAt: T0 });
    const archived = await conversation({ archivedAt: T0, lastMessageAt: T1 });
    await message(newer.id, { createdAt: T1 });
    await message(older.id, { createdAt: T0 });
    await message(archived.id);
    const { conversations: list, total } = await repo.listConversations({});
    expect(total).toBe(2);
    expect(list.map((c) => c.conversationId)).toEqual([newer.id, older.id]);
    expect(list[0]).toMatchObject({ accountId, lastMessagePreview: "Hi", unreadCount: 1 });
  });

  it("status=unread narrows to Conversations with an unread customer message; status=archived to archived ones", async () => {
    const unread = await conversation();
    const read = await conversation();
    const archived = await conversation({ archivedAt: T0 });
    await message(unread.id);
    await message(read.id, { readAt: T0 });
    await message(archived.id);
    expect((await repo.listConversations({ status: "unread" })).conversations.map((c) => c.conversationId)).toEqual([unread.id]);
    expect((await repo.listConversations({ status: "archived" })).conversations.map((c) => c.conversationId)).toEqual([archived.id]);
  });

  it("search matches the customer's name, email or the Conversation's subject", async () => {
    const c = await conversation();
    await message(c.id);
    expect((await repo.listConversations({ search: "jordan" })).conversations.map((x) => x.conversationId)).toEqual([c.id]);
    expect(await repo.listConversations({ search: "nobody-here" })).toEqual({ conversations: [], total: 0 });
  });

  it("channel filter matches the latest Message's channel", async () => {
    const emailLast = await conversation({ lastMessageAt: T1 });
    const smsLast = await conversation({ lastMessageAt: T0 });
    await message(emailLast.id, { channel: "SMS", createdAt: T0 });
    await message(emailLast.id, { channel: "EMAIL", createdAt: T1 });
    await message(smsLast.id, { channel: "EMAIL", createdAt: T0 });
    await message(smsLast.id, { channel: "SMS", createdAt: T1 });
    expect((await repo.listConversations({ channel: "EMAIL" })).conversations.map((c) => c.conversationId)).toEqual([emailLast.id]);
    expect((await repo.listConversations({ channel: "SMS" })).conversations.map((c) => c.conversationId)).toEqual([smsLast.id]);
    expect((await repo.listConversations({ channel: "IN_APP" })).total).toBe(0);
    expect((await repo.listConversations({ channel: "all" })).total).toBe(2);
  });

  it("pages with limit/offset and reports the full total; unread count and preview still come from the right Messages", async () => {
    const a = await conversation({ lastMessageAt: new Date("2026-10-03T00:00:00Z") });
    const b = await conversation({ lastMessageAt: new Date("2026-10-02T00:00:00Z") });
    const c = await conversation({ lastMessageAt: new Date("2026-10-01T00:00:00Z") });
    await message(a.id, { createdAt: T0 });
    await prisma.message.create({ data: { conversationId: a.id, author: "ADMIN", body: "Latest", createdAt: T1 } });
    await message(b.id);
    await message(c.id);
    const first = await repo.listConversations({ limit: 2, offset: 0 });
    expect(first.total).toBe(3);
    expect(first.conversations.map((x) => x.conversationId)).toEqual([a.id, b.id]);
    expect(first.conversations[0]).toMatchObject({ lastMessagePreview: "Latest", unreadCount: 1 });
    expect((await repo.listConversations({ limit: 2, offset: 2 })).conversations.map((x) => x.conversationId)).toEqual([c.id]);
  });
});

describe("getConversationThread", () => {
  it("returns the whole thread for an existing Conversation, oldest first", async () => {
    const c = await conversation();
    await message(c.id, { createdAt: T0 });
    await message(c.id, { createdAt: T1 });
    const thread = await repo.getConversationThread(c.id);
    expect(thread?.messages).toHaveLength(2);
    expect(thread).toMatchObject({ accountId, customerEmail: EMAIL });
  });

  it("returns null for an id no Conversation has", async () => {
    expect(await repo.getConversationThread("nope")).toBeNull();
  });
});

describe("setConversationArchived", () => {
  it("sets and clears archivedAt", async () => {
    const c = await conversation();
    await repo.setConversationArchived(c.id, true, T1);
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: c.id } })).archivedAt).toEqual(T1);
    await repo.setConversationArchived(c.id, false, T1);
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: c.id } })).archivedAt).toBeNull();
  });

  it("throws ConversationNotFoundError for an unknown id", async () => {
    await expect(repo.setConversationArchived("nope", true, T1)).rejects.toThrow(ConversationNotFoundError);
  });
});

describe("startConversation", () => {
  const start = (idempotencyKey = "start-key") => ({
    accountId,
    accountEmail: EMAIL,
    accountName: "Jordan",
    subject: "A new thread",
    authorAccountId: null,
    body: "Hello!",
    idempotencyKey,
    at: T1,
  });

  it("creates a Conversation and its first ADMIN message", async () => {
    const result = await repo.startConversation(start());
    const created = await prisma.conversation.findUniqueOrThrow({ where: { id: result.conversationId } });
    expect(created).toMatchObject({ accountId, subject: "A new thread", lastMessageAt: T1 });
    const stored = await prisma.message.findFirstOrThrow({ where: { conversationId: result.conversationId } });
    expect(stored).toMatchObject({ author: "ADMIN", channel: "EMAIL", body: "Hello!" });
  });

  it("a replay, even racing, creates only one Conversation", async () => {
    const results = await Promise.all([repo.startConversation(start()), repo.startConversation(start())]);
    expect(new Set(results.map((r) => r.conversationId)).size).toBe(1);
    expect(await prisma.conversation.count()).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(await repo.startConversation(start())).toEqual({ conversationId: results[0]!.conversationId, created: false });
  });
});
