import { describe, expect, it } from "vitest";
import type { ActingUser } from "@/features/accounts/authz";
import { OrderNotFoundError } from "../repositories/payment-repository";
import { InMemoryPaymentRepository } from "../repositories/in-memory-payment-repository";
import { InvalidRecordPaymentError, recordPayment } from "./record-payment";

const admin: ActingUser = { accountId: "acc_admin", role: "ADMIN" };

function seeded() {
  const payments = new InMemoryPaymentRepository();
  payments.addOrder({ id: "o1", number: 1008, contactName: "Jordan", contactEmail: "j@example.com", contactPhone: "212", estimateCents: 12000, items: [] });
  return payments;
}

describe("recordPayment", () => {
  it("rejects a non-admin", async () => {
    const payments = seeded();
    await expect(
      recordPayment({ payments }, { accountId: "c", role: "CUSTOMER" }, { orderReference: "ATU-1008", amountCents: 100, method: "CASH", reference: null, idempotencyKey: "k1" }),
    ).rejects.toThrow();
  });

  it("records a payment against an order found by its number", async () => {
    const payments = seeded();
    const result = await recordPayment({ payments }, admin, { orderReference: "ATU-1008", amountCents: 1500, method: "CASH", reference: null, idempotencyKey: "k1" });
    expect(result).toBe("recorded");
    const { rows } = await payments.searchPayments({ q: null, method: null, status: null, from: null, to: null, limit: 10, offset: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amount.cents).toBe(1500);
  });

  it("is idempotent on the key", async () => {
    const payments = seeded();
    await recordPayment({ payments }, admin, { orderReference: "ATU-1008", amountCents: 1500, method: "CASH", reference: null, idempotencyKey: "k1" });
    const second = await recordPayment({ payments }, admin, { orderReference: "ATU-1008", amountCents: 1500, method: "CASH", reference: null, idempotencyKey: "k1" });
    expect(second).toBe("already-recorded");
    const { rows } = await payments.searchPayments({ q: null, method: null, status: null, from: null, to: null, limit: 10, offset: 0 });
    expect(rows).toHaveLength(1);
  });

  it("throws OrderNotFoundError for an unknown order", async () => {
    const payments = seeded();
    await expect(recordPayment({ payments }, admin, { orderReference: "ATU-9999", amountCents: 1500, method: "CASH", reference: null, idempotencyKey: "k1" })).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
  });

  it("rejects a non-positive amount", async () => {
    const payments = seeded();
    await expect(recordPayment({ payments }, admin, { orderReference: "ATU-1008", amountCents: 0, method: "CASH", reference: null, idempotencyKey: "k1" })).rejects.toBeInstanceOf(
      InvalidRecordPaymentError,
    );
  });
});
