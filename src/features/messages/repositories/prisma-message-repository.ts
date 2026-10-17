import { Prisma, type PrismaClient } from "@prisma/client";
import {
  ConversationNotFoundError,
  IdempotencyKeyReusedError,
  type ConversationFilter,
  type ConversationPage,
  type ConversationSummary,
  type ConversationThread,
  type MessageRepository,
  type ReplyRecipient,
  type UnreadConversation,
} from "./message-repository";

const UNREAD_CUSTOMER = { author: "CUSTOMER", readAt: null } as const;

export class PrismaMessageRepository implements MessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  countUnread(): Promise<number> {
    return this.prisma.message.count({ where: { ...UNREAD_CUSTOMER, conversation: { archivedAt: null } } });
  }

  async listUnreadConversations(): Promise<UnreadConversation[]> {
    const rows = await this.prisma.conversation.findMany({
      where: { archivedAt: null, messages: { some: UNREAD_CUSTOMER } },
      orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
      include: {
        account: { select: { name: true, email: true } },
        order: { select: { id: true, number: true } },
        messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      },
    });
    return rows.map((c) => ({
      conversationId: c.id,
      subject: c.subject,
      customerName: c.account.name,
      customerEmail: c.account.email,
      order: c.order,
      unreadCount: c.messages.filter((m) => m.author === "CUSTOMER" && m.readAt === null).length,
      lastMessageAt: c.lastMessageAt,
      messages: c.messages.map(({ id, author, channel, body, readAt, createdAt }) => ({ id, author, channel, body, readAt, createdAt })),
    }));
  }

  async markConversationRead(conversationId: string, at: Date): Promise<number> {
    const { count } = await this.prisma.message.updateMany({ where: { conversationId, ...UNREAD_CUSTOMER }, data: { readAt: at } });
    return count;
  }

  async storeAdminReply(input: Parameters<MessageRepository["storeAdminReply"]>[0]): Promise<ReplyRecipient | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const conversation = await tx.conversation.findUnique({
          where: { id: input.conversationId },
          select: { subject: true, account: { select: { email: true } }, order: { select: { number: true } } },
        });
        if (!conversation) throw new ConversationNotFoundError();
        const used = await tx.message.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { conversationId: true } });
        if (used) {
          if (used.conversationId !== input.conversationId) throw new IdempotencyKeyReusedError();
          return null;
        }
        await tx.message.create({
          data: {
            conversationId: input.conversationId,
            author: "ADMIN",
            authorAccountId: input.authorAccountId,
            channel: "EMAIL",
            body: input.body,
            idempotencyKey: input.idempotencyKey,
            createdAt: input.at,
          },
        });
        await tx.conversation.update({ where: { id: input.conversationId }, data: { lastMessageAt: input.at } });
        return { email: conversation.account.email, orderNumber: conversation.order?.number ?? null, subject: conversation.subject };
      });
    } catch (err) {
      // Two submits of the same key racing: the loser hits the unique index.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null;
      throw err;
    }
  }

  async listConversations(filter: ConversationFilter): Promise<ConversationPage> {
    const search = filter.search?.trim();
    // "Latest Message's channel" can't be expressed in Prisma's filter, so SQL picks the matching ids.
    let channelIds: string[] | null = null;
    if (filter.channel && filter.channel !== "all") {
      const rows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT c.id FROM conversations c
        WHERE (SELECT m.channel::text FROM messages m WHERE m."conversationId" = c.id ORDER BY m."createdAt" DESC, m.id DESC LIMIT 1) = ${filter.channel}`;
      channelIds = rows.map((r) => r.id);
    }
    const where: Prisma.ConversationWhereInput = {
      // Archived is its own tab; "all" and "unread" both mean the inbox (not archived).
      archivedAt: filter.status === "archived" ? { not: null } : null,
      ...(filter.status === "unread" ? { messages: { some: UNREAD_CUSTOMER } } : {}),
      ...(channelIds ? { id: { in: channelIds } } : {}),
      ...(search
        ? {
            OR: [
              { subject: { contains: search, mode: "insensitive" } },
              { account: { name: { contains: search, mode: "insensitive" } } },
              { account: { email: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
        ...(filter.limit !== undefined ? { take: filter.limit } : {}),
        skip: filter.offset ?? 0,
        select: {
          id: true,
          accountId: true,
          subject: true,
          archivedAt: true,
          lastMessageAt: true,
          account: { select: { name: true, email: true } },
          order: { select: { id: true, number: true } },
          // Only the latest Message (the preview) and an unread count, not the whole thread.
          messages: { take: 1, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { body: true } },
          _count: { select: { messages: { where: UNREAD_CUSTOMER } } },
        },
      }),
    ]);
    return {
      total,
      conversations: rows.map((c) => ({
        conversationId: c.id,
        accountId: c.accountId,
        customerName: c.account.name,
        customerEmail: c.account.email,
        subject: c.subject,
        order: c.order,
        archivedAt: c.archivedAt,
        lastMessageAt: c.lastMessageAt,
        lastMessagePreview: c.messages[0]?.body ?? null,
        unreadCount: c._count.messages,
      })),
    };
  }

  async getConversationThread(conversationId: string): Promise<ConversationThread | null> {
    const c = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        account: { select: { name: true, email: true } },
        order: { select: { id: true, number: true } },
        messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      },
    });
    if (!c) return null;
    return {
      conversationId: c.id,
      accountId: c.accountId,
      subject: c.subject,
      customerName: c.account.name,
      customerEmail: c.account.email,
      order: c.order,
      archivedAt: c.archivedAt,
      unreadCount: c.messages.filter((m) => m.author === "CUSTOMER" && m.readAt === null).length,
      lastMessageAt: c.lastMessageAt,
      messages: c.messages.map(({ id, author, channel, body, readAt, createdAt }) => ({ id, author, channel, body, readAt, createdAt })),
    };
  }

  async setConversationArchived(conversationId: string, archived: boolean, at: Date): Promise<void> {
    const { count } = await this.prisma.conversation.updateMany({ where: { id: conversationId }, data: { archivedAt: archived ? at : null } });
    if (count === 0) throw new ConversationNotFoundError();
  }

  async startConversation(input: Parameters<MessageRepository["startConversation"]>[0]): Promise<{ conversationId: string; created: boolean }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const used = await tx.message.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { conversationId: true } });
        if (used) return { conversationId: used.conversationId, created: false };
        const conversation = await tx.conversation.create({
          data: { accountId: input.accountId, subject: input.subject, lastMessageAt: input.at },
        });
        await tx.message.create({
          data: {
            conversationId: conversation.id,
            author: "ADMIN",
            authorAccountId: input.authorAccountId,
            channel: "EMAIL",
            body: input.body,
            idempotencyKey: input.idempotencyKey,
            createdAt: input.at,
          },
        });
        return { conversationId: conversation.id, created: true };
      });
    } catch (err) {
      // Two submits of the same key racing: the loser re-reads what the winner made.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const used = await this.prisma.message.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey }, select: { conversationId: true } });
        return { conversationId: used.conversationId, created: false };
      }
      throw err;
    }
  }
}
