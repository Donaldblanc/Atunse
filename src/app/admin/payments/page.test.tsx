import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActingUser } from "@/features/accounts/authz";
import { InMemoryPaymentRepository, type InMemoryOrderSeed, type InMemoryPaymentSeed } from "@/features/payments/repositories/in-memory-payment-repository";

let actingUser: ActingUser = { accountId: "acc_admin", role: "ADMIN" };
vi.mock("next/headers", () => ({ cookies: async () => new Map() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/features/accounts/acting-user", () => ({ actingUserFromCookies: async () => actingUser }));

const payments = new InMemoryPaymentRepository();
vi.mock("@/features/payments/deps", () => ({ buildPaymentsDeps: () => ({ payments }) }));

const { default: AdminPaymentsPage } = await import("./page");

let seq = 0;

function order(overrides: Partial<InMemoryOrderSeed> = {}): InMemoryOrderSeed {
  const id = `order_${++seq}`;
  return {
    id,
    number: 1000 + seq,
    contactName: "Jordan Smith",
    contactEmail: "jordan@example.com",
    contactPhone: "2125550142",
    estimateCents: 12000,
    items: [{ brand: "Nike", model: "Air Max 90", colorway: "Black", serviceIds: ["standard"], priceCents: 12000, estimateCents: 12000 }],
    ...overrides,
  };
}

function payment(orderId: string, overrides: Partial<InMemoryPaymentSeed> = {}): InMemoryPaymentSeed {
  return {
    id: `payment_${++seq}`,
    orderId,
    kind: "FULL",
    method: "APPLE_PAY",
    amountCents: 12000,
    status: "RECEIVED",
    reference: "ch_abc123",
    createdAt: new Date(Date.now() - 60_000),
    receivedAt: new Date(Date.now() - 60_000),
    ...overrides,
  };
}

describe("AdminPaymentsPage", () => {
  beforeEach(() => {
    actingUser = { accountId: "acc_admin", role: "ADMIN" };
    payments.orders.clear();
    payments.payments.length = 0;
  });

  it("lists payments with the order, customer and amount", async () => {
    const o = order();
    payments.addOrder(o);
    payments.addPayment(payment(o.id));
    const html = renderToStaticMarkup(await AdminPaymentsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Jordan Smith");
    expect(html).toContain("$120");
  });

  it("rejects a non-admin acting user", async () => {
    actingUser = { accountId: "acc_c", role: "CUSTOMER" };
    await expect(AdminPaymentsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow();
  });

  it("shows the empty state when no payments match", async () => {
    const html = renderToStaticMarkup(await AdminPaymentsPage({ searchParams: Promise.resolve({ q: "nobody-here" }) }));
    expect(html).toContain("No payments match these filters.");
  });

  it("shows the Payment Details panel for ?payment=", async () => {
    const o = order();
    payments.addOrder(o);
    const p = payment(o.id);
    payments.addPayment(p);
    const html = renderToStaticMarkup(await AdminPaymentsPage({ searchParams: Promise.resolve({ payment: p.id }) }));
    expect(html).toContain("Payment Details");
    expect(html).toContain("Refund Payment");
    expect(html).toContain(`/admin/orders/${o.id}`);
  });

  it("doesn't offer a refund for a pending payment", async () => {
    const o = order();
    payments.addOrder(o);
    const p = payment(o.id, { status: "PENDING", receivedAt: null });
    payments.addPayment(p);
    const html = renderToStaticMarkup(await AdminPaymentsPage({ searchParams: Promise.resolve({ payment: p.id }) }));
    expect(html).not.toContain("Refund Payment");
  });
});
