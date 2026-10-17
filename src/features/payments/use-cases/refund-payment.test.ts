import { describe, expect, it } from "vitest";
import type { ActingUser } from "@/features/accounts/authz";
import { PaymentNotFoundError, PaymentNotRefundableError, PaymentRefundBlockedError } from "../repositories/payment-repository";
import { InMemoryPaymentRepository } from "../repositories/in-memory-payment-repository";
import { refundPayment } from "./refund-payment";

const admin: ActingUser = { accountId: "acc_admin", role: "ADMIN" };

const item = (status: "IN_PROGRESS" | "CANCELLED") => ({ status, brand: "Nike", model: "AM90", colorway: null, serviceIds: ["standard"], priceCents: 12000, estimateCents: 12000 });

type Options = { kind?: "DEPOSIT" | "BALANCE" | "FULL"; method?: "ZELLE" | "CASH" | "CARD" | "APPLE_PAY"; items?: ReturnType<typeof item>[] };

function seeded(status: "RECEIVED" | "PENDING" | "FAILED" | "REFUNDED" = "RECEIVED", { kind = "FULL", method = "CASH", items = [item("IN_PROGRESS")] }: Options = {}) {
  const payments = new InMemoryPaymentRepository();
  payments.addOrder({ id: "o1", number: 1008, contactName: "Jordan", contactEmail: "j@example.com", contactPhone: "212", estimateCents: 12000, items });
  payments.addPayment({ id: "p1", orderId: "o1", kind, method, amountCents: 12000, status, reference: "ch_1", createdAt: new Date(), receivedAt: status === "RECEIVED" ? new Date() : null });
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

  it("refuses to refund a card or Apple Pay payment", async () => {
    for (const method of ["CARD", "APPLE_PAY"] as const) {
      const payments = seeded("RECEIVED", { method });
      const err = await refundPayment({ payments }, admin, { paymentId: "p1", reason: null, idempotencyKey: "k1" }).catch((e) => e);
      expect(err).toBeInstanceOf(PaymentRefundBlockedError);
      expect(err.message).toBe("Card refunds aren't available yet.");
    }
  });

  it("refuses to refund a Deposit or Balance while a pair is live", async () => {
    for (const kind of ["DEPOSIT", "BALANCE"] as const) {
      const payments = seeded("RECEIVED", { kind });
      const err = await refundPayment({ payments }, admin, { paymentId: "p1", reason: null, idempotencyKey: "k1" }).catch((e) => e);
      expect(err).toBeInstanceOf(PaymentRefundBlockedError);
      expect(err.message).toBe("Cancel the order's pairs before refunding its deposit or balance.");
      expect((await payments.getPaymentDetail("p1"))?.status).toBe("RECEIVED");
    }
  });

  it("refunds a Deposit or Balance once every pair is cancelled", async () => {
    for (const kind of ["DEPOSIT", "BALANCE"] as const) {
      const payments = seeded("RECEIVED", { kind, items: [item("CANCELLED")] });
      expect(await refundPayment({ payments }, admin, { paymentId: "p1", reason: null, idempotencyKey: "k1" })).toBe("refunded");
    }
  });

  it("refunds a Full payment even with live pairs (completion doesn't read it)", async () => {
    const payments = seeded("RECEIVED", { kind: "FULL" });
    expect(await refundPayment({ payments }, admin, { paymentId: "p1", reason: null, idempotencyKey: "k1" })).toBe("refunded");
  });

  it("words the refund timeline as the owner marking it", async () => {
    const payments = seeded();
    await refundPayment({ payments }, admin, { paymentId: "p1", reason: null, idempotencyKey: "k1" });
    const detail = await payments.getPaymentDetail("p1");
    expect(detail?.timeline.at(-1)?.detail).toBe("Marked refunded by the owner.");
  });
});
