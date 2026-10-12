import { describe, expect, it } from "vitest";
import type { ActingUser } from "@/features/accounts/authz";
import { DEFAULT_OVERVIEW_RANGE, overviewRange } from "@/features/admin-overview/overview-range";
import { InMemoryPaymentRepository } from "../repositories/in-memory-payment-repository";
import { listPayments, parsePaymentsQuery } from "./list-payments";

const admin: ActingUser = { accountId: "acc_admin", role: "ADMIN" };

function deps() {
  return { payments: new InMemoryPaymentRepository() };
}

describe("listPayments", () => {
  it("rejects a non-admin", async () => {
    const { payments } = deps();
    await expect(listPayments({ payments }, { accountId: "c", role: "CUSTOMER" }, parsePaymentsQuery({}), overviewRange(DEFAULT_OVERVIEW_RANGE, new Date()))).rejects.toThrow();
  });

  it("totals paid, pending and failed/refunded for the current period", async () => {
    const { payments } = deps();
    const now = new Date();
    // Created a minute before "now", so it's strictly inside the range (createdAt < range.end, a still-in-progress range's end).
    const createdAt = new Date(now.getTime() - 60_000);
    payments.addOrder({ id: "o1", number: 1001, contactName: "Jordan", contactEmail: "j@example.com", contactPhone: "212", estimateCents: 12000, items: [] });
    payments.addPayment({ id: "p1", orderId: "o1", kind: "FULL", method: "APPLE_PAY", amountCents: 12000, status: "RECEIVED", reference: null, createdAt, receivedAt: createdAt });
    payments.addPayment({ id: "p2", orderId: "o1", kind: "DEPOSIT", method: "ZELLE", amountCents: 5000, status: "PENDING", reference: null, createdAt });
    payments.addPayment({ id: "p3", orderId: "o1", kind: "BALANCE", method: "CARD", amountCents: 3000, status: "FAILED", reference: null, createdAt });

    const range = overviewRange(DEFAULT_OVERVIEW_RANGE, now);
    const list = await listPayments({ payments }, admin, parsePaymentsQuery({}), range);
    expect(list.stats.paid.amount).toBe("$120");
    expect(list.stats.pending.amount).toBe("$50");
    expect(list.stats.failedOrRefunded.amount).toBe("$30");
    expect(list.total).toBe(3);
  });

  it("filters by method, status and text", async () => {
    const { payments } = deps();
    const now = new Date();
    const createdAt = new Date(now.getTime() - 60_000);
    payments.addOrder({ id: "o1", number: 1008, contactName: "Jordan Smith", contactEmail: "j@example.com", contactPhone: "212", estimateCents: 12000, items: [] });
    payments.addPayment({ id: "p1", orderId: "o1", kind: "FULL", method: "APPLE_PAY", amountCents: 12000, status: "RECEIVED", reference: "ch_1", createdAt, receivedAt: createdAt });

    const range = overviewRange(DEFAULT_OVERVIEW_RANGE, now);
    const byMethod = await listPayments({ payments }, admin, parsePaymentsQuery({ method: "ZELLE" }), range);
    expect(byMethod.total).toBe(0);

    const byQuery = await listPayments({ payments }, admin, parsePaymentsQuery({ q: "ATU-1008" }), range);
    expect(byQuery.total).toBe(1);
  });
});
