import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActingUser } from "@/features/accounts/authz";
import { InMemoryPaymentRepository } from "./repositories/in-memory-payment-repository";

let actingUser: ActingUser = { accountId: "acc_admin", role: "ADMIN" };
vi.mock("next/headers", () => ({ cookies: async () => new Map() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/accounts/acting-user", () => ({
  actingUserFromCookies: async () => actingUser,
}));

let payments = new InMemoryPaymentRepository();
vi.mock("@/features/payments/deps", () => ({
  buildPaymentsDeps: () => ({ payments }),
}));

const { recordPaymentAction } = await import("./record-payment-action");
const { refundPaymentAction } = await import("./refund-payment-action");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = {
  orderReference: "ATU-1008",
  amount: "15",
  method: "CASH",
  reference: "",
  idempotencyKey: "k1",
};

beforeEach(() => {
  actingUser = { accountId: "acc_admin", role: "ADMIN" };
  payments = new InMemoryPaymentRepository();
  payments.addOrder({
    id: "o1",
    number: 1008,
    contactName: "Jordan",
    contactEmail: "j@example.com",
    contactPhone: "212",
    estimateCents: 12000,
    items: [],
  });
});

describe("recordPaymentAction", () => {
  it("turns dollars into whole cents, rounding", async () => {
    expect(await recordPaymentAction(form({ ...valid, amount: "19.999" }))).toEqual({ ok: true });
    expect(await recordPaymentAction(form({ ...valid, amount: "0.1", idempotencyKey: "k2" }))).toEqual({ ok: true });
    const { rows } = await payments.searchPayments({
      q: null,
      method: null,
      status: null,
      from: null,
      to: null,
      limit: 10,
      offset: 0,
    });
    expect(rows.map((row) => row.amount.cents).sort((a, b) => a - b)).toEqual([10, 2000]);
  });

  it("explains bad input", async () => {
    expect(await recordPaymentAction(form({ ...valid, amount: "abc" }))).toEqual({ ok: false, error: "Enter a valid amount." });
    expect(await recordPaymentAction(form({ ...valid, amount: "0" }))).toEqual({
      ok: false,
      error: "Enter an amount greater than $0.",
    });
    expect(await recordPaymentAction(form({ ...valid, amount: "0.004" }))).toEqual({ ok: false, error: "Enter an amount greater than $0." });
    expect(await recordPaymentAction(form({ ...valid, method: "BITCOIN" }))).toEqual({ ok: false, error: "Choose a payment method." });
    expect(await recordPaymentAction(form({ ...valid, orderReference: "ATU-9" }))).toEqual({ ok: false, error: "No order matches that number." });
    expect(await recordPaymentAction(new FormData())).toEqual({
      ok: false,
      error: "Something went wrong. Reload and try again.",
    });
  });

  it("reports an ended session for a non-admin", async () => {
    actingUser = { accountId: "c", role: "CUSTOMER" };
    const result = await recordPaymentAction(form(valid));
    expect(result.ok).toBe(false);
  });
});

describe("refundPaymentAction", () => {
  beforeEach(() => {
    payments.addPayment({
      id: "p1",
      orderId: "o1",
      kind: "FULL",
      method: "CASH",
      amountCents: 1500,
      status: "RECEIVED",
      reference: null,
      createdAt: new Date(),
      receivedAt: new Date(),
    });
    payments.addPayment({
      id: "p2",
      orderId: "o1",
      kind: "FULL",
      method: "CARD",
      amountCents: 1500,
      status: "RECEIVED",
      reference: "ch_1",
      createdAt: new Date(),
      receivedAt: new Date(),
    });
  });

  it("refunds, and explains why it can't", async () => {
    expect(await refundPaymentAction("p1", "", "k1")).toEqual({ ok: true });
    expect(await refundPaymentAction("p1", "", "k1")).toEqual({ ok: true }); // retry with the same key
    expect(await refundPaymentAction("p1", "", "k2")).toEqual({
      ok: false,
      error: "Only a received payment can be refunded.",
    });
    expect(await refundPaymentAction("p2", "", "k3")).toEqual({
      ok: false,
      error: "Card refunds aren't available yet.",
    });
    expect(await refundPaymentAction("nope", "", "k4")).toEqual({
      ok: false,
      error: "That payment no longer exists.",
    });
    expect(await refundPaymentAction("p1", "x".repeat(301), "k5")).toEqual({
      ok: false,
      error: "Reason is too long.",
    });
    expect(await refundPaymentAction("", "", "k6")).toEqual({
      ok: false,
      error: "Something went wrong. Reload and try again.",
    });
  });
});
