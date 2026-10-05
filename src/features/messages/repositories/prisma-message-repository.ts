import { Prisma, type PrismaClient } from "@prisma/client";
import {
  ConversationNotFoundError,
  IdempotencyKeyReusedError,
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
}
