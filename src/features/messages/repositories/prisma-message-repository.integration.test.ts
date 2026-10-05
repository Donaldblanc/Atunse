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
const message = (conversationId: string, data: { author?: "CUSTOMER" | "ADMIN"; readAt?: Date; createdAt?: Date } = {}) =>
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
