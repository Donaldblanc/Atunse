import { describe, expect, it, vi } from "vitest";
import { UnauthorizedError, type ActingUser } from "@/features/accounts/authz";
import { InMemoryAccounts } from "@/features/accounts/repositories/in-memory-repositories";
import { RecordingNotificationService } from "@/features/orders/use-cases/test-fixtures";
import { IdempotencyKeyReusedError } from "../repositories/message-repository";
import { InMemoryMessageRepository } from "../repositories/in-memory-message-repository";
import { getConversationThread } from "./get-conversation-thread";
import { countUnreadMessages, listUnreadConversations } from "./get-unread-messages";
import { CONVERSATIONS_PAGE_SIZE, listConversations } from "./list-conversations";
import { markConversationRead } from "./mark-conversation-read";
import { InvalidReplyError, replyToConversation, REPLY_MAX_LENGTH } from "./reply-to-conversation";
import { setConversationArchived } from "./set-conversation-archived";
import { CustomerNotFoundError, InvalidMessageError, newMessageSubject, startConversation } from "./start-conversation";

const ADMIN: ActingUser = { accountId: "acc_admin", role: "ADMIN" };
const CUSTOMER: ActingUser = { accountId: "acc_c", role: "CUSTOMER" };
const GUEST: ActingUser = { accountId: null, role: "GUEST" };
const NOW = new Date("2026-10-02T12:00:00Z");

function setup() {
  const messages = new InMemoryMessageRepository();
  messages.addConversation({ id: "c1", accountEmail: "jordan@example.com", accountName: "Jordan", order: { id: "o1", number: 1008 }, lastMessageAt: new Date("2026-10-01T12:00:00Z") });
  messages.addMessage({ conversationId: "c1", body: "Where are my sneakers?" });
  messages.addMessage({ conversationId: "c1", body: "Hello?", createdAt: new Date("2026-10-01T13:00:00Z") });
  messages.addConversation({ id: "c2", archivedAt: new Date("2026-09-01T00:00:00Z") });
  messages.addMessage({ conversationId: "c2" });
  messages.addConversation({ id: "c3" });
  messages.addMessage({ conversationId: "c3", readAt: new Date("2026-10-01T14:00:00Z") });
  messages.addMessage({ conversationId: "c3", author: "ADMIN" });
  const notifications = new RecordingNotificationService();
  return { messages, notifications, deps: { messages, notifications, now: () => NOW } };
}

describe("unread messages", () => {
  it("counts unread CUSTOMER messages in unarchived Conversations only", async () => {
    expect(await countUnreadMessages(setup(), ADMIN)).toBe(2);
  });

  it("lists only Conversations with unread messages, thread oldest first", async () => {
    const list = await listUnreadConversations(setup(), ADMIN);
    expect(list.map((c) => c.conversationId)).toEqual(["c1"]);
    expect(list[0]).toMatchObject({ unreadCount: 2, order: { number: 1008 }, customerEmail: "jordan@example.com" });
    expect(list[0]!.messages.map((m) => m.body)).toEqual(["Where are my sneakers?", "Hello?"]);
  });

  it.each([["customer", CUSTOMER], ["guest", GUEST]])("refuses a %s", async (_label, user) => {
    const repo = setup();
    await expect(countUnreadMessages(repo, user)).rejects.toThrow(UnauthorizedError);
    await expect(listUnreadConversations(repo, user)).rejects.toThrow(UnauthorizedError);
    await expect(markConversationRead(repo.deps, user, { conversationId: "c1" })).rejects.toThrow(UnauthorizedError);
    await expect(replyToConversation(repo.deps, user, { conversationId: "c1", body: "Hi", idempotencyKey: "k" })).rejects.toThrow(UnauthorizedError);
  });
});

describe("markConversationRead", () => {
  it("reads that Conversation's unread CUSTOMER messages only, and a repeat does nothing", async () => {
    const { messages, deps } = setup();
    expect(await markConversationRead(deps, ADMIN, { conversationId: "c1" })).toEqual({ marked: 2 });
    expect(messages.messages.filter((m) => m.conversationId === "c1").every((m) => m.readAt?.getTime() === NOW.getTime())).toBe(true);
    expect(await messages.countUnread()).toBe(0); // c2 is archived
    expect(messages.messages.find((m) => m.conversationId === "c2")!.readAt).toBeNull();
    expect(await markConversationRead(deps, ADMIN, { conversationId: "c1" })).toEqual({ marked: 0 });
  });
});

describe("replyToConversation", () => {
  const input = { conversationId: "c1", body: "  On its way Friday.  ", idempotencyKey: "key-1" };

  it("stores an ADMIN EMAIL message, bumps lastMessageAt and emails the Account", async () => {
    const { messages, notifications, deps } = setup();
    expect(await replyToConversation(deps, ADMIN, input)).toEqual({ status: "sent", emailFailed: false });
    expect(messages.messages.at(-1)).toMatchObject({ author: "ADMIN", channel: "EMAIL", body: "On its way Friday.", authorAccountId: "acc_admin", idempotencyKey: "key-1" });
    expect(messages.conversations[0]!.lastMessageAt).toEqual(NOW);
    expect(notifications.sent).toEqual([{ to: "jordan@example.com", subject: "Re: your Atunṣe order ATU-1008", body: "On its way Friday." }]);
  });

  it("collapses line breaks in the Conversation's subject", async () => {
    const { messages, notifications, deps } = setup();
    messages.conversations[2]!.subject = "Time\r\nBcc: x@evil.test";
    await replyToConversation(deps, ADMIN, { ...input, conversationId: "c3" });
    expect(notifications.sent[0]!.subject).toBe("Re: Time Bcc: x@evil.test");
  });

  it("refuses a key already used for a different Conversation and writes nothing", async () => {
    const { messages, notifications, deps } = setup();
    await replyToConversation(deps, ADMIN, input);
    const stored = messages.messages.length;
    await expect(replyToConversation(deps, ADMIN, { ...input, conversationId: "c3" })).rejects.toThrow(IdempotencyKeyReusedError);
    expect(messages.messages).toHaveLength(stored);
    expect(notifications.sent).toHaveLength(1);
  });

  it("uses the Conversation's subject when it has no Order", async () => {
    const { messages, notifications, deps } = setup();
    messages.conversations[2]!.subject = "Time confirmation";
    await replyToConversation(deps, ADMIN, { ...input, conversationId: "c3" });
    expect(notifications.sent[0]!.subject).toBe("Re: Time confirmation");
  });

  it("a replay writes nothing and sends nothing", async () => {
    const { messages, notifications, deps } = setup();
    await replyToConversation(deps, ADMIN, input);
    const stored = messages.messages.length;
    expect(await replyToConversation(deps, ADMIN, input)).toEqual({ status: "already-sent" });
    expect(messages.messages).toHaveLength(stored);
    expect(notifications.sent).toHaveLength(1);
  });

  it("keeps the Message and reports a failed send, logging only a masked address", async () => {
    const { messages, notifications, deps } = setup();
    notifications.sendEmail = async () => {
      throw new Error("Resend rejected jordan@example.com");
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await replyToConversation(deps, ADMIN, input)).toEqual({ status: "sent", emailFailed: true });
    expect(messages.messages.at(-1)!.author).toBe("ADMIN");
    expect(log).toHaveBeenCalledOnce();
    const logged = String(log.mock.calls[0]![0]);
    expect(logged).toContain("j***@example.com");
    expect(logged).not.toContain("jordan@example.com");
    log.mockRestore();
  });

  it.each([["empty", "   "], ["too long", "x".repeat(REPLY_MAX_LENGTH + 1)]])("refuses a %s body before writing", async (_label, body) => {
    const { messages, deps } = setup();
    const before = messages.messages.length;
    await expect(replyToConversation(deps, ADMIN, { ...input, body })).rejects.toThrow(InvalidReplyError);
    expect(messages.messages).toHaveLength(before);
  });

  it("accepts exactly 5000 characters", async () => {
    const { deps } = setup();
    await expect(replyToConversation(deps, ADMIN, { ...input, body: "x".repeat(REPLY_MAX_LENGTH) })).resolves.toMatchObject({ status: "sent" });
  });

  it("refuses a missing idempotency key and an unknown Conversation", async () => {
    const { deps } = setup();
    await expect(replyToConversation(deps, ADMIN, { ...input, idempotencyKey: "" })).rejects.toThrow(InvalidReplyError);
    await expect(replyToConversation(deps, ADMIN, { ...input, conversationId: "nope" })).rejects.toThrow("Conversation not found");
  });
});

describe("listConversations", () => {
  it("defaults to the inbox (not archived), newest first", async () => {
    const { deps } = setup();
    const { conversations: list, total } = await listConversations(deps, ADMIN, {});
    expect(total).toBe(2);
    expect(list.map((c) => c.conversationId)).toEqual(["c1", "c3"]);
    expect(list[0]).toMatchObject({ lastMessagePreview: "Hello?", unreadCount: 2 });
  });

  it("status=unread narrows to Conversations with an unread customer message", async () => {
    const { deps } = setup();
    expect((await listConversations(deps, ADMIN, { status: "unread" })).conversations.map((c) => c.conversationId)).toEqual(["c1"]);
  });

  it("status=archived shows only archived Conversations", async () => {
    const { deps } = setup();
    expect((await listConversations(deps, ADMIN, { status: "archived" })).conversations.map((c) => c.conversationId)).toEqual(["c2"]);
  });

  it("search matches the customer's name, email or the Conversation's subject", async () => {
    const { deps } = setup();
    expect((await listConversations(deps, ADMIN, { search: "jordan" })).conversations.map((c) => c.conversationId)).toEqual(["c1"]);
    expect((await listConversations(deps, ADMIN, { search: "nobody" })).conversations).toEqual([]);
  });

  it("channel filter matches the latest Message's channel", async () => {
    const { messages, deps } = setup();
    messages.addMessage({ conversationId: "c1", channel: "SMS", createdAt: new Date("2026-10-02T00:00:00Z") });
    messages.addMessage({ conversationId: "c3", channel: "EMAIL", createdAt: new Date("2026-10-03T00:00:00Z") });
    expect((await listConversations(deps, ADMIN, { channel: "SMS" })).conversations.map((c) => c.conversationId)).toEqual(["c1"]);
    expect((await listConversations(deps, ADMIN, { channel: "EMAIL" })).conversations.map((c) => c.conversationId)).toEqual(["c3"]);
    expect((await listConversations(deps, ADMIN, { channel: "all" })).total).toBe(2);
  });

  it("pages the list and clamps a bad page number", async () => {
    const { messages, deps } = setup();
    for (let i = 0; i < CONVERSATIONS_PAGE_SIZE; i++) messages.addConversation({ id: `x${i}`, lastMessageAt: new Date(2026, 8, 1, 0, i) });
    const first = await listConversations(deps, ADMIN, {});
    expect(first).toMatchObject({ total: CONVERSATIONS_PAGE_SIZE + 2, page: 1, pageCount: 2 });
    expect(first.conversations).toHaveLength(CONVERSATIONS_PAGE_SIZE);
    expect((await listConversations(deps, ADMIN, { page: 2 })).conversations).toHaveLength(2);
    expect((await listConversations(deps, ADMIN, { page: -3 })).page).toBe(1);
  });

  it("refuses a non-admin", async () => {
    const { deps } = setup();
    await expect(listConversations(deps, CUSTOMER, {})).rejects.toThrow(UnauthorizedError);
  });
});

describe("getConversationThread", () => {
  it("returns the whole thread, oldest first, for an existing Conversation", async () => {
    const { deps } = setup();
    const thread = await getConversationThread(deps, ADMIN, "c1");
    expect(thread?.messages.map((m) => m.body)).toEqual(["Where are my sneakers?", "Hello?"]);
  });

  it("returns null for an id no Conversation has", async () => {
    const { deps } = setup();
    expect(await getConversationThread(deps, ADMIN, "nope")).toBeNull();
  });

  it("refuses a non-admin", async () => {
    const { deps } = setup();
    await expect(getConversationThread(deps, CUSTOMER, "c1")).rejects.toThrow(UnauthorizedError);
  });
});

describe("setConversationArchived", () => {
  it("archives and unarchives, a repeat staying a no-op", async () => {
    const { messages, deps } = setup();
    await setConversationArchived(deps, ADMIN, { conversationId: "c1", archived: true });
    expect(messages.conversations[0]!.archivedAt).toEqual(NOW);
    await setConversationArchived(deps, ADMIN, { conversationId: "c1", archived: false });
    expect(messages.conversations[0]!.archivedAt).toBeNull();
  });

  it("refuses a non-admin", async () => {
    const { deps } = setup();
    await expect(setConversationArchived(deps, CUSTOMER, { conversationId: "c1", archived: true })).rejects.toThrow(UnauthorizedError);
  });
});

describe("startConversation", () => {
  function setupWithAccounts() {
    const base = setup();
    const accounts = new InMemoryAccounts();
    accounts.add({ id: "acc_new", role: "CUSTOMER", email: "new@example.com" });
    return { ...base, accounts, deps: { ...base.deps, accounts } };
  }

  it("creates a Conversation and its first ADMIN message for an existing Customer Account", async () => {
    const { messages, notifications, deps } = setupWithAccounts();
    const result = await startConversation(deps, ADMIN, { customerEmail: "New@Example.com", subject: "Hi", body: "  Welcome!  ", idempotencyKey: "start-1" });
    const conversation = messages.conversations.find((c) => c.id === result.conversationId);
    expect(conversation).toMatchObject({ accountId: "acc_new", accountEmail: "new@example.com", subject: "Hi" });
    const stored = messages.messages.find((m) => m.conversationId === result.conversationId);
    expect(stored).toMatchObject({ author: "ADMIN", channel: "EMAIL", body: "Welcome!", authorAccountId: "acc_admin" });
    expect(result.emailFailed).toBe(false);
    expect(notifications.sent).toEqual([{ to: "new@example.com", subject: "Hi", body: "Welcome!" }]);
  });

  it("titles a new thread with its subject as typed, or a plain fallback, never a \"Re:\"", () => {
    expect(newMessageSubject("Your pair\r\nBcc: x@example.com")).toBe("Your pair Bcc: x@example.com");
    expect(newMessageSubject(null)).toBe("A message from Atunṣe");
  });

  it("keeps the Message and reports a failed send, logging only a masked address", async () => {
    const { messages, notifications, deps } = setupWithAccounts();
    notifications.sendEmail = async () => {
      throw new Error("Resend rejected new@example.com");
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await startConversation(deps, ADMIN, { customerEmail: "new@example.com", subject: null, body: "Hi", idempotencyKey: "start-f" });
    expect(result.emailFailed).toBe(true);
    expect(messages.messages.find((m) => m.conversationId === result.conversationId)).toMatchObject({ author: "ADMIN" });
    expect(String(log.mock.calls[0]![0])).not.toContain("new@example.com");
    log.mockRestore();
  });

  it("a replay returns the first call's Conversation and writes nothing new", async () => {
    const { messages, notifications, deps } = setupWithAccounts();
    const input = { customerEmail: "new@example.com", subject: null, body: "Hi", idempotencyKey: "start-2" };
    const first = await startConversation(deps, ADMIN, input);
    const before = messages.conversations.length;
    const second = await startConversation(deps, ADMIN, input);
    expect(second).toEqual(first);
    expect(messages.conversations).toHaveLength(before);
    expect(notifications.sent).toHaveLength(1); // no second email
  });

  it("refuses an email with no Customer Account", async () => {
    const { deps } = setupWithAccounts();
    await expect(startConversation(deps, ADMIN, { customerEmail: "nobody@example.com", subject: null, body: "Hi", idempotencyKey: "k" })).rejects.toThrow(
      CustomerNotFoundError,
    );
  });

  it.each([["empty", "   "], ["too long", "x".repeat(REPLY_MAX_LENGTH + 1)]])("refuses a %s body", async (_label, body) => {
    const { deps } = setupWithAccounts();
    await expect(startConversation(deps, ADMIN, { customerEmail: "new@example.com", subject: null, body, idempotencyKey: "k" })).rejects.toThrow(
      InvalidMessageError,
    );
  });

  it("refuses a missing idempotency key", async () => {
    const { deps } = setupWithAccounts();
    await expect(startConversation(deps, ADMIN, { customerEmail: "new@example.com", subject: null, body: "Hi", idempotencyKey: "" })).rejects.toThrow(
      InvalidMessageError,
    );
  });

  it("refuses a non-admin", async () => {
    const { deps } = setupWithAccounts();
    await expect(
      startConversation(deps, CUSTOMER, { customerEmail: "new@example.com", subject: null, body: "Hi", idempotencyKey: "k" }),
    ).rejects.toThrow(UnauthorizedError);
  });
});
