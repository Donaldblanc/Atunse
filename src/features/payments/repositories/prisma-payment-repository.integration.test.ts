// Proves PrismaPaymentRepository against a REAL Postgres. Requires TEST_DATABASE_URL; run with `npm run test:integration`.

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Money } from "@/shared/money/money";
import { PrismaOrderRepository } from "@/features/orders/repositories/prisma-order-repository";
import type { NewItemInput, NewOrderInput } from "@/features/orders/repositories/order-repository";
import { deleteAllOrders } from "@/shared/testing/delete-all-orders";
import { OrderNotFoundError, PaymentNotRefundableError, PaymentRefundBlockedError } from "./payment-repository";
import { PrismaPaymentRepository } from "./prisma-payment-repository";

const prisma = new PrismaClient();
const orders = new PrismaOrderRepository(prisma);
const payments = new PrismaPaymentRepository(prisma);

beforeEach(async () => {
  await deleteAllOrders(prisma);
  await prisma.signInCode.deleteMany();
  await prisma.account.deleteMany({ where: { role: "CUSTOMER" } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

let counter = 0;
function pair(overrides: Partial<NewItemInput> = {}): NewItemInput {
  counter += 1;
  return {
    brand: "Nike",
    model: "Air Max 90",
    description: null,
    material: null,
    serviceIds: ["standard"],
    estimate: Money.fromCents(3000),
    requiresQuote: true,
    photos: [{ key: `photos/pay-${counter}.jpg`, uploadKey: `bookings/pay-${counter}.jpg` }],
    ...overrides,
  };
}

async function book(name: string) {
  counter += 1;
  const input: NewOrderInput = {
    owner: { newCustomer: { email: `pay${counter}@example.com`, phone: "2125550142" } },
    contactName: name,
    contactEmail: `pay${counter}@example.com`,
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
    alertBody: "Alert",
    items: [pair()],
  };
  const { order } = await orders.create(input);
  return order;
}

describe("PrismaPaymentRepository (integration)", () => {
  it("records a payment against an Order found by number, idempotently", async () => {
    const order = await book("Jordan Smith");
    const first = await payments.recordPayment({
      orderReference: `ATU-${order.number}`,
      amountCents: 1500,
      method: "CASH",
      reference: null,
      actorAccountId: null,
      idempotencyKey: "rec-1",
    });
    expect(first).toBe("recorded");

    const second = await payments.recordPayment({
      orderReference: `ATU-${order.number}`,
      amountCents: 1500,
      method: "CASH",
      reference: null,
      actorAccountId: null,
      idempotencyKey: "rec-1",
    });
    expect(second).toBe("already-recorded");

    const { rows, total } = await payments.searchPayments({ q: null, method: null, status: null, from: null, to: null, limit: 10, offset: 0 });
    // The booking's own Deposit plus the one Record Payment call (the replay wrote nothing).
    expect(total).toBe(2);
    expect(rows.some((row) => row.amount.cents === 1500 && row.method === "CASH")).toBe(true);
  });

  it("throws OrderNotFoundError for an unknown order", async () => {
    await expect(
      payments.recordPayment({ orderReference: "ATU-99999", amountCents: 1500, method: "CASH", reference: null, actorAccountId: null, idempotencyKey: "rec-2" }),
    ).rejects.toBeInstanceOf(OrderNotFoundError);
  });

  it("refunds a received payment and is idempotent", async () => {
    const order = await book("Sam Rivera");
    await payments.recordPayment({ orderReference: `ATU-${order.number}`, amountCents: 2000, method: "CASH", reference: null, actorAccountId: null, idempotencyKey: "rec-3" });
    const { rows } = await payments.searchPayments({ q: null, method: "CASH", status: null, from: null, to: null, limit: 10, offset: 0 });
    const paymentId = rows[0]!.id;

    const first = await payments.refundPayment({ paymentId, reason: "Customer request", actorAccountId: null, idempotencyKey: "ref-1" });
    expect(first).toBe("refunded");
    const detail = await payments.getPaymentDetail(paymentId);
    expect(detail?.status).toBe("REFUNDED");
    expect(detail?.timeline.map((entry) => entry.label)).toContain("Payment refunded");

    const second = await payments.refundPayment({ paymentId, reason: null, actorAccountId: null, idempotencyKey: "ref-1" });
    expect(second).toBe("already-refunded");
  });

  it("refuses to refund a payment that was never received", async () => {
    const order = await book("Pending Payer");
    const { rows } = await payments.searchPayments({ q: `ATU-${order.number}`, method: null, status: "PENDING", from: null, to: null, limit: 10, offset: 0 });
    const paymentId = rows[0]!.id; // the booking's PENDING Deposit
    await expect(payments.refundPayment({ paymentId, reason: null, actorAccountId: null, idempotencyKey: "ref-2" })).rejects.toBeInstanceOf(PaymentNotRefundableError);
  });

  it("totals paid, pending and failed/refunded within a range", async () => {
    const order = await book("Stats Buyer");
    await payments.recordPayment({ orderReference: `ATU-${order.number}`, amountCents: 5000, method: "CASH", reference: null, actorAccountId: null, idempotencyKey: "rec-4" });
    const stats = await payments.statsFor({ start: new Date(Date.now() - 60_000), end: new Date(Date.now() + 60_000) });
    expect(stats.paid.amount.cents).toBeGreaterThanOrEqual(5000);
  });

  it("finds payments by customer name and by reference text", async () => {
    const order = await book("Marisol Okafor");
    await payments.recordPayment({ orderReference: `ATU-${order.number}`, amountCents: 900, method: "ZELLE", reference: "zelle-conf-77Q", actorAccountId: null, idempotencyKey: "rec-5" });
    const search = (q: string) => payments.searchPayments({ q, method: null, status: null, from: null, to: null, limit: 10, offset: 0 });

    expect((await search("okafor")).total).toBe(2); // the Deposit and the recorded payment
    const byReference = await search("CONF-77q");
    expect(byReference.total).toBe(1);
    expect(byReference.rows[0]!.reference).toBe("zelle-conf-77Q");
    expect((await search("100%")).total).toBe(0); // LIKE wildcards are literal
  });

  it("words the refund timeline as the owner marking it", async () => {
    const order = await book("Timeline Tess");
    await payments.recordPayment({ orderReference: `ATU-${order.number}`, amountCents: 2000, method: "CASH", reference: null, actorAccountId: null, idempotencyKey: "rec-6" });
    const { rows } = await payments.searchPayments({ q: null, method: "CASH", status: null, from: null, to: null, limit: 10, offset: 0 });
    await payments.refundPayment({ paymentId: rows[0]!.id, reason: null, actorAccountId: null, idempotencyKey: "ref-6" });
    const detail = await payments.getPaymentDetail(rows[0]!.id);
    expect(detail?.timeline.at(-1)?.detail).toBe("Marked refunded by the owner.");
  });

  it("refuses to refund a card payment", async () => {
    const order = await book("Card Carl");
    const deposit = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id, kind: "DEPOSIT" } });
    await prisma.payment.update({ where: { id: deposit.id }, data: { method: "CARD", status: "RECEIVED", receivedAt: new Date() } });
    const err = await payments.refundPayment({ paymentId: deposit.id, reason: null, actorAccountId: null, idempotencyKey: "ref-7" }).catch((e) => e);
    expect(err).toBeInstanceOf(PaymentRefundBlockedError);
    expect(err.message).toBe("Card refunds aren't available yet.");
  });

  it("refuses to refund a Deposit or Balance while a pair is live, and allows it once cancelled", async () => {
    const order = await book("Strand Sam");
    const deposit = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id, kind: "DEPOSIT" } });
    await prisma.payment.update({ where: { id: deposit.id }, data: { status: "RECEIVED", receivedAt: new Date() } });

    const err = await payments.refundPayment({ paymentId: deposit.id, reason: null, actorAccountId: null, idempotencyKey: "ref-8" }).catch((e) => e);
    expect(err).toBeInstanceOf(PaymentRefundBlockedError);
    expect((await payments.getPaymentDetail(deposit.id))?.status).toBe("RECEIVED");

    await prisma.item.updateMany({ where: { orderId: order.id }, data: { status: "CANCELLED" } });
    expect(await payments.refundPayment({ paymentId: deposit.id, reason: null, actorAccountId: null, idempotencyKey: "ref-9" })).toBe("refunded");
  });

  it("settles concurrent submits with the same key once", async () => {
    const order = await book("Race Rae");
    const record = () => payments.recordPayment({ orderReference: `ATU-${order.number}`, amountCents: 1100, method: "CASH", reference: null, actorAccountId: null, idempotencyKey: "race-rec" });
    expect([...(await Promise.all([record(), record()]))].sort()).toEqual(["already-recorded", "recorded"]);

    const { rows } = await payments.searchPayments({ q: null, method: "CASH", status: null, from: null, to: null, limit: 10, offset: 0 });
    const refund = () => payments.refundPayment({ paymentId: rows[0]!.id, reason: null, actorAccountId: null, idempotencyKey: "race-ref" });
    expect([...(await Promise.all([refund(), refund()]))].sort()).toEqual(["already-refunded", "refunded"]);
  });

  it("leaves a FAILED Balance (a cancelled one) out of Failed/Refunded", async () => {
    const order = await book("Cancelled Cal");
    await prisma.payment.create({ data: { orderId: order.id, kind: "BALANCE", method: "ZELLE", amountCents: 1500, status: "FAILED", failureReason: "The order was cancelled." } });
    const stats = await payments.statsFor({ start: new Date(Date.now() - 60_000), end: new Date(Date.now() + 60_000) });
    expect(stats.failedOrRefunded.count).toBe(0);
  });
});
