// The Messages seam (ADR-0011): the admin inbox reads and writes Conversations
// and Messages only through this interface. Prisma and in-memory twins behave
// identically.

export interface ThreadMessage {
  id: string;
  author: "CUSTOMER" | "ADMIN";
  channel: "IN_APP" | "EMAIL" | "SMS";
  body: string;
  readAt: Date | null;
  createdAt: Date;
}

/** A Conversation with unread CUSTOMER messages, its whole thread oldest first. */
export interface UnreadConversation {
  conversationId: string;
  subject: string | null;
  customerName: string | null;
  customerEmail: string;
  /** The Order it's about, when it has one. */
  order: { id: string; number: number } | null;
  unreadCount: number;
  lastMessageAt: Date | null;
  messages: ThreadMessage[];
}

/** Who a reply goes to, and what the email's subject can reference. */
export interface ReplyRecipient {
  email: string;
  orderNumber: number | null;
  subject: string | null;
}

export class ConversationNotFoundError extends Error {
  constructor() {
    super("Conversation not found");
    this.name = "ConversationNotFoundError";
  }
}

export class IdempotencyKeyReusedError extends Error {
  constructor() {
    super("That idempotency key belongs to a reply in another conversation");
    this.name = "IdempotencyKeyReusedError";
  }
}

export interface MessageRepository {
  /** CUSTOMER messages with readAt null, in Conversations that aren't archived. */
  countUnread(): Promise<number>;
  /** Unarchived Conversations with at least one unread CUSTOMER message, latest activity first. */
  listUnreadConversations(): Promise<UnreadConversation[]>;
  /** Sets readAt on the Conversation's unread CUSTOMER messages; returns how many. */
  markConversationRead(conversationId: string, at: Date): Promise<number>;
  /**
   * In ONE transaction: stores an ADMIN-authored EMAIL Message and bumps the
   * Conversation's lastMessageAt. Returns the recipient, or null when the
   * idempotency key was already used (a replay writes nothing).
   * Throws ConversationNotFoundError, or IdempotencyKeyReusedError when the
   * key was used for a different Conversation.
   */
  storeAdminReply(input: {
    conversationId: string;
    authorAccountId: string | null;
    body: string;
    idempotencyKey: string;
    at: Date;
  }): Promise<ReplyRecipient | null>;
}
