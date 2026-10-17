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

/** One row of the Messages screen's list (`/admin/messages`): every Conversation, read or not. */
export interface ConversationSummary {
  conversationId: string;
  accountId: string;
  customerName: string | null;
  customerEmail: string;
  subject: string | null;
  order: { id: string; number: number } | null;
  archivedAt: Date | null;
  lastMessageAt: Date | null;
  /** The latest Message's body, for the list row's preview line. */
  lastMessagePreview: string | null;
  unreadCount: number;
}

export interface ConversationFilter {
  /** Matched against the customer's name, email and the Conversation's subject. */
  search?: string;
  /** "all" is every un-archived Conversation (the default inbox tab); "unread" narrows to those with an unread customer message. */
  status?: "all" | "unread" | "archived";
  /** Narrows to Conversations whose latest Message used this channel. */
  channel?: "all" | "IN_APP" | "EMAIL" | "SMS";
  /** Page window (the list is always bounded); the use-case sets these from the page number. */
  limit?: number;
  offset?: number;
}

/** One page of the list, plus how many Conversations match the filter in all. */
export interface ConversationPage {
  conversations: ConversationSummary[];
  total: number;
}

/** One Conversation's whole thread, open or not (the Messages screen's thread view). */
export interface ConversationThread extends UnreadConversation {
  accountId: string;
  archivedAt: Date | null;
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
  /** The window (`limit`/`offset`) of Conversations matching `filter`, latest activity first (the Messages screen's list). */
  listConversations(filter: ConversationFilter): Promise<ConversationPage>;
  /** One Conversation's whole thread, or null for an id none has. */
  getConversationThread(conversationId: string): Promise<ConversationThread | null>;
  /** Sets or clears archivedAt (the Messages screen's Archive / Unarchive). */
  setConversationArchived(conversationId: string, archived: boolean, at: Date): Promise<void>;
  /**
   * In ONE transaction: creates a Conversation for `accountId` and its first
   * (ADMIN-authored, EMAIL) Message. Idempotent on `idempotencyKey`: a
   * replay creates nothing and returns the Conversation the first call made,
   * with `created: false`.
   */
  startConversation(input: {
    accountId: string;
    /** Only the in-memory twin needs these (it has no Account table to join); Prisma reads them off the relation. */
    accountEmail: string;
    accountName: string | null;
    subject: string | null;
    authorAccountId: string | null;
    body: string;
    idempotencyKey: string;
    at: Date;
  }): Promise<{ conversationId: string; created: boolean }>;
}
