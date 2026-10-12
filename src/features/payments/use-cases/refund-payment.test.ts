import { describe, expect, it } from "vitest";
import type { ActingUser } from "@/features/accounts/authz";
import { PaymentNotFoundError, PaymentNotRefundableError } from "../repositories/payment-repository";
import { InMemoryPaymentRepository } from "../repositories/in-memory-payment-repository";
import { refundPayment } from "./refund-payment";

const admin: ActingUser = { accountId: "acc_admin", role: "ADMIN" };

function seeded(status: "RECEIVED" | "PENDING" | "FAILED" | "REFUNDED" = "RECEIVED") {
  const payments = new InMemoryPaymentRepository();
  payments.addOrder({ id: "o1", number: 1008, contactName: "Jordan", contactEmail: "j@example.com", contactPhone: "212", estimateCents: 12000, items: [] });
  payments.addPayment({ id: "p1", orderId: "o1", kind: "FULL", method: "APPLE_PAY", amountCents: 12000, status, reference: "ch_1", createdAt: new Date(), receivedAt: status === "RECEIVED" ? new Date() : null });
  return payments;
}

describe("refundPayment", () => {
  it("rejects a non-admin", async () => {
    const payments = seeded();
    await expect(refundPayment({ payments }, { accountId: "c", role: "CUSTOMER" }, { paymentId: "p1", reason: null, idempotencyKey: "k1" })).rejects.toThrow();
  });

  it("refunds a received payment", async () => {
    const payments = seeded();
    const result = await refundPayment({ payments }, admin, { paymentId: "p1", reason: "Customer request", idempotencyKey: "k1" });
    expect(result).toBe("refunded");
    const detail = await payments.getPaymentDetail("p1");
    expect(detail?.status).toBe("REFUNDED");
  });

  it("is idempotent on the key", async () => {
    const payments = seeded();
    await refundPayment({ payments }, admin, { paymentId: "p1", reason: null, idempotencyKey: "k1" });
    const second = await refundPayment({ payments }, admin, { paymentId: "p1", reason: null, idempotencyKey: "k1" });
    expect(second).toBe("already-refunded");
  });

  it("throws PaymentNotFoundError for an unknown payment", async () => {
    const payments = seeded();
    await expect(refundPayment({ payments }, admin, { paymentId: "missing", reason: null, idempotencyKey: "k1" })).rejects.toBeInstanceOf(PaymentNotFoundError);
  });

  it("throws PaymentNotRefundableError for a payment that was never received", async () => {
    const payments = seeded("PENDING");
    await expect(refundPayment({ payments }, admin, { paymentId: "p1", reason: null, idempotencyKey: "k1" })).rejects.toBeInstanceOf(PaymentNotRefundableError);
  });
});
