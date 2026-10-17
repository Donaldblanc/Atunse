import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActingUser } from "@/features/accounts/authz";
import { InMemoryAccounts } from "@/features/accounts/repositories/in-memory-repositories";
import { InMemoryMessageRepository } from "@/features/messages/repositories/in-memory-message-repository";
import { InMemoryOrderRepository } from "@/features/orders/repositories/in-memory-order-repository";
import type { NewOrderInput } from "@/features/orders/repositories/order-repository";
import { Money } from "@/shared/money/money";

let actingUser: ActingUser = { accountId: "acc_admin", role: "ADMIN" };
vi.mock("next/headers", () => ({ cookies: async () => new Map() }));
vi.mock("@/features/accounts/acting-user", () => ({ actingUserFromCookies: async () => actingUser }));

const messages = new InMemoryMessageRepository();
const accounts = new InMemoryAccounts();
const orders = new InMemoryOrderRepository();
vi.mock("@/features/admin-messages/deps", () => ({
  buildAdminMessagesDeps: () => ({ messages, accounts, orders, notifications: { sendEmail: async () => {} }, now: () => new Date("2026-10-11T12:00:00Z"), photoUrl: async () => null }),
}));

const { default: AdminMessagesPage } = await import("./page");

function order(overrides: Partial<NewOrderInput> = {}): NewOrderInput {
  return {
    owner: { newCustomer: { email: "jordan@example.com", phone: "2125550142" } },
    contactName: "Jordan Smith",
    contactEmail: "jordan@example.com",
    contactPhone: "2125550142",
    policyAcceptedAt: new Date(),
    terms: { version: "v1", url: "/terms.pdf", sha256: "x", acknowledgments: {} },
    fulfillment: { method: "MAIL_IN", address: { line1: "1 Main St", line2: null, city: "Austin", state: "TX", zip: "73301" }, preferredDate: null },
    rush: false,
    estimate: Money.fromCents(3000),
    estimateIsMinimum: false,
    deposit: Money.fromCents(1500),
    depositPayment: { method: "ZELLE", amount: Money.fromCents(1500) },
    collection: null,
    submissionKey: null,
    submissionFingerprint: null,
    bundleId: null,
    alertBody: "Jordan · Standard Clean · Mail-In",
    items: [{ brand: "Nike", model: "Air Max 90", description: null, material: null, serviceIds: ["standard"], estimate: Money.fromCents(3000), requiresQuote: true, photos: [] }],
    ...overrides,
  };
}

describe("AdminMessagesPage", () => {
  beforeEach(() => {
    actingUser = { accountId: "acc_admin", role: "ADMIN" };
    messages.conversations.length = 0;
    messages.messages.length = 0;
    accounts.accounts.length = 0;
  });

  it("lists Conversations and opens the first one's thread by default", async () => {
    accounts.add({ id: "acc_jordan", role: "CUSTOMER", email: "jordan@example.com", name: "Jordan" });
    messages.addConversation({ id: "c1", accountId: "acc_jordan", accountEmail: "jordan@example.com", accountName: "Jordan", lastMessageAt: new Date("2026-10-10T12:00:00Z") });
    messages.addMessage({ conversationId: "c1", body: "Hi there" });

    const html = renderToStaticMarkup(await AdminMessagesPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Jordan");
    expect(html).toContain("Hi there");
    expect(html).toContain("Customer Information");
  });

  it("shows no Order card when the open Conversation has none", async () => {
    accounts.add({ id: "acc_jordan", role: "CUSTOMER", email: "jordan@example.com", name: "Jordan" });
    messages.addConversation({ id: "c1", accountId: "acc_jordan", accountEmail: "jordan@example.com" });
    messages.addMessage({ conversationId: "c1" });

    const html = renderToStaticMarkup(await AdminMessagesPage({ searchParams: Promise.resolve({}) }));
    expect(html).not.toContain("View Order");
  });

  it("shows the linked Order's card when the Conversation has one", async () => {
    accounts.add({ id: "acc_jordan", role: "CUSTOMER", email: "jordan@example.com", name: "Jordan" });
    const { order: booked } = await orders.create(order());
    messages.addConversation({ id: "c1", accountId: "acc_jordan", accountEmail: "jordan@example.com", order: { id: booked.id, number: booked.number } });
    messages.addMessage({ conversationId: "c1" });

    const html = renderToStaticMarkup(await AdminMessagesPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("View Order");
    expect(html).toContain(`href="/admin/orders/${booked.id}"`);
  });

  it("shows the empty state when there are no conversations", async () => {
    const html = renderToStaticMarkup(await AdminMessagesPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("No conversations.");
    expect(html).toContain("No conversation selected.");
  });

  it("the Unread tab narrows the list", async () => {
    accounts.add({ id: "acc_a", role: "CUSTOMER", email: "a@example.com" });
    accounts.add({ id: "acc_b", role: "CUSTOMER", email: "b@example.com" });
    messages.addConversation({ id: "c1", accountId: "acc_a", accountEmail: "a@example.com", accountName: "Has Unread" });
    messages.addMessage({ conversationId: "c1" });
    messages.addConversation({ id: "c2", accountId: "acc_b", accountEmail: "b@example.com", accountName: "All Read" });
    messages.addMessage({ conversationId: "c2", readAt: new Date("2026-10-01T00:00:00Z") });

    const html = renderToStaticMarkup(await AdminMessagesPage({ searchParams: Promise.resolve({ status: "unread" }) }));
    expect(html).toContain("Has Unread");
    expect(html).not.toContain("All Read");
  });

  it("shows Mark read only when the open thread has unread messages", async () => {
    accounts.add({ id: "acc_a", role: "CUSTOMER", email: "a@example.com" });
    messages.addConversation({ id: "c1", accountId: "acc_a", accountEmail: "a@example.com" });
    messages.addMessage({ conversationId: "c1" });
    expect(renderToStaticMarkup(await AdminMessagesPage({ searchParams: Promise.resolve({}) }))).toContain("Mark read");
    await messages.markConversationRead("c1", new Date());
    const html = renderToStaticMarkup(await AdminMessagesPage({ searchParams: Promise.resolve({}) }));
    expect(html).not.toContain("Mark read");
    expect(html).not.toContain("Unread (");
  });

  it("the Unread tab count is the inbox total, whatever the search filter", async () => {
    accounts.add({ id: "acc_a", role: "CUSTOMER", email: "a@example.com" });
    accounts.add({ id: "acc_b", role: "CUSTOMER", email: "b@example.com" });
    messages.addConversation({ id: "c1", accountId: "acc_a", accountEmail: "a@example.com", accountName: "Alpha" });
    messages.addMessage({ conversationId: "c1" });
    messages.addConversation({ id: "c2", accountId: "acc_b", accountEmail: "b@example.com", accountName: "Beta" });
    messages.addMessage({ conversationId: "c2" });
    messages.addMessage({ conversationId: "c2" });
    const html = renderToStaticMarkup(await AdminMessagesPage({ searchParams: Promise.resolve({ q: "Alpha" }) }));
    expect(html).toContain("Unread (3)");
  });

  it("rejects a non-admin acting user", async () => {
    actingUser = { accountId: "acc_c", role: "CUSTOMER" };
    await expect(AdminMessagesPage({ searchParams: Promise.resolve({}) })).rejects.toThrow();
  });
});
