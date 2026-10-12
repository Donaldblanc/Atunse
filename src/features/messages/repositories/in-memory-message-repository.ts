import {
  ConversationNotFoundError,
  IdempotencyKeyReusedError,
  type ConversationFilter,
  type ConversationSummary,
  type ConversationThread,
  type MessageRepository,
  type ReplyRecipient,
  type ThreadMessage,
  type UnreadConversation,
} from "./message-repository";

export interface StoredConversation {
  id: string;
  accountId: string;
  accountEmail: string;
  accountName: string | null;
  order: { id: string; number: number } | null;
  subject: string | null;
  archivedAt: Date | null;
  lastMessageAt: Date | null;
}

export interface StoredMessage extends ThreadMessage {
  conversationId: string;
  authorAccountId: string | null;
  idempotencyKey: string | null;
}

/** Test twin of PrismaMessageRepository: same behaviour, kept in arrays. */
export class InMemoryMessageRepository implements MessageRepository {
  conversations: StoredConversation[] = [];
  messages: StoredMessage[] = [];
  private nextId = 1;

  addConversation(input: Partial<StoredConversation> & { id: string }): StoredConversation {
    const conversation: StoredConversation = {
      accountId: `acc_${input.id}`,
      accountEmail: "customer@example.com",
      accountName: null,
      order: null,
      subject: null,
      archivedAt: null,
      lastMessageAt: null,
      ...input,
    };
    this.conversations.push(conversation);
    return conversation;
  }

  addMessage(input: Partial<StoredMessage> & { conversationId: string }): StoredMessage {
    const message: StoredMessage = {
      id: `msg_${this.nextId++}`,
      author: "CUSTOMER",
      channel: "IN_APP",
      body: "Hello",
      readAt: null,
      createdAt: new Date("2026-10-01T12:00:00Z"),
      authorAccountId: null,
      idempotencyKey: null,
      ...input,
    };
    this.messages.push(message);
    return message;
  }

  private unreadIn(conversationId: string) {
    return this.messages.filter((m) => m.conversationId === conversationId && m.author === "CUSTOMER" && m.readAt === null);
  }

  async countUnread(): Promise<number> {
    return this.conversations.filter((c) => !c.archivedAt).reduce((sum, c) => sum + this.unreadIn(c.id).length, 0);
  }

  async listUnreadConversations(): Promise<UnreadConversation[]> {
    return this.conversations
      .filter((c) => !c.archivedAt && this.unreadIn(c.id).length > 0)
      .sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0))
      .map((c) => ({
        conversationId: c.id,
        subject: c.subject,
        customerName: c.accountName,
        customerEmail: c.accountEmail,
        order: c.order,
        unreadCount: this.unreadIn(c.id).length,
        lastMessageAt: c.lastMessageAt,
        messages: this.messages
          .filter((m) => m.conversationId === c.id)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map(({ id, author, channel, body, readAt, createdAt }) => ({ id, author, channel, body, readAt, createdAt })),
      }));
  }

  async markConversationRead(conversationId: string, at: Date): Promise<number> {
    const unread = this.unreadIn(conversationId);
    for (const message of unread) message.readAt = at;
    return unread.length;
  }

  async storeAdminReply(input: Parameters<MessageRepository["storeAdminReply"]>[0]): Promise<ReplyRecipient | null> {
    const conversation = this.conversations.find((c) => c.id === input.conversationId);
    if (!conversation) throw new ConversationNotFoundError();
    const used = this.messages.find((m) => m.idempotencyKey === input.idempotencyKey);
    if (used) {
      if (used.conversationId !== input.conversationId) throw new IdempotencyKeyReusedError();
      return null;
    }
    this.addMessage({
      conversationId: conversation.id,
      author: "ADMIN",
      channel: "EMAIL",
      body: input.body,
      authorAccountId: input.authorAccountId,
      idempotencyKey: input.idempotencyKey,
      createdAt: input.at,
    });
    conversation.lastMessageAt = input.at;
    return { email: conversation.accountEmail, orderNumber: conversation.order?.number ?? null, subject: conversation.subject };
  }

  async listConversations(filter: ConversationFilter): Promise<ConversationSummary[]> {
    const search = filter.search?.trim().toLowerCase();
    return this.conversations
      .filter((c) => (filter.status === "archived" ? c.archivedAt !== null : c.archivedAt === null))
      .filter((c) => filter.status !== "unread" || this.unreadIn(c.id).length > 0)
      .filter((c) => {
        if (!search) return true;
        return (c.accountName ?? "").toLowerCase().includes(search) || c.accountEmail.toLowerCase().includes(search) || (c.subject ?? "").toLowerCase().includes(search);
      })
      .filter((c) => {
        if (!filter.channel || filter.channel === "all") return true;
        const latest = this.threadOf(c.id).at(-1);
        return latest?.channel === filter.channel;
      })
      .sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0))
      .map((c) => ({
        conversationId: c.id,
        accountId: c.accountId,
        customerName: c.accountName,
        customerEmail: c.accountEmail,
        subject: c.subject,
        order: c.order,
        archivedAt: c.archivedAt,
        lastMessageAt: c.lastMessageAt,
        lastMessagePreview: this.threadOf(c.id).at(-1)?.body ?? null,
        unreadCount: this.unreadIn(c.id).length,
      }));
  }

  private threadOf(conversationId: string): StoredMessage[] {
    return this.messages.filter((m) => m.conversationId === conversationId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getConversationThread(conversationId: string): Promise<ConversationThread | null> {
    const c = this.conversations.find((conversation) => conversation.id === conversationId);
    if (!c) return null;
    return {
      conversationId: c.id,
      accountId: c.accountId,
      subject: c.subject,
      customerName: c.accountName,
      customerEmail: c.accountEmail,
      order: c.order,
      archivedAt: c.archivedAt,
      unreadCount: this.unreadIn(c.id).length,
      lastMessageAt: c.lastMessageAt,
      messages: this.threadOf(c.id).map(({ id, author, channel, body, readAt, createdAt }) => ({ id, author, channel, body, readAt, createdAt })),
    };
  }

  async setConversationArchived(conversationId: string, archived: boolean, at: Date): Promise<void> {
    const conversation = this.conversations.find((c) => c.id === conversationId);
    if (!conversation) throw new ConversationNotFoundError();
    conversation.archivedAt = archived ? at : null;
  }

  async startConversation(input: Parameters<MessageRepository["startConversation"]>[0]): Promise<{ conversationId: string }> {
    const used = this.messages.find((m) => m.idempotencyKey === input.idempotencyKey);
    if (used) return { conversationId: used.conversationId };
    const conversation = this.addConversation({
      id: `conv_${this.nextId++}`,
      accountId: input.accountId,
      accountEmail: input.accountEmail,
      accountName: input.accountName,
      subject: input.subject,
      lastMessageAt: input.at,
    });
    this.addMessage({
      conversationId: conversation.id,
      author: "ADMIN",
      channel: "EMAIL",
      body: input.body,
      authorAccountId: input.authorAccountId,
      idempotencyKey: input.idempotencyKey,
      createdAt: input.at,
    });
    return { conversationId: conversation.id };
  }
}
