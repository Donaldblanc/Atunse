import { describe, expect, it } from "vitest";
import { UnauthorizedError, type ActingUser } from "@/features/accounts/authz";
import { Money } from "@/shared/money/money";
import { InMemoryOrderRepository } from "../repositories/in-memory-order-repository";
import { NoPendingPaymentError, type NewItemInput, type NewOrderInput } from "../repositories/order-repository";
import { confirmPayment, InvalidPaymentMethodError } from "./confirm-payment";

const ADMIN: ActingUser = { accountId: "acc_admin", role: "ADMIN" };

let counter = 0;
function pair(): NewItemInput {
  counter += 1;
  return {
    brand: null,
    model: null,
    description: null,
    material: null,
    serviceIds: ["standard"],
    estimate: Money.fromCents(3000),
    photos: [{ key: `photos/${counter}.jpg`, uploadKey: `bookings/${counter}.jpg` }],
  };
}

async function bookOrder(pairs = 1) {
  counter += 1;
  const orders = new InMemoryOrderRepository();
  const input: NewOrderInput = {
    owner: { newCustomer: { email: `c${counter}@example.com`, phone: "2125550142" } },
    contactName: "Jordan Smith",
    contactEmail: `c${counter}@example.com`,
    contactPhone: "2125550142",
    policyAcceptedAt: new Date(),
    terms: { version: "v1", url: "/terms.pdf", sha256: "x", acknowledgments: {} },
    fulfillment: { method: "MAIL_IN", address: { line1: "1 Main St", line2: null, city: "Austin", state: "TX", zip: "73301" }, preferredDate: null },
    rush: false,
    estimate: Money.fromCents(3000 * pairs),
    estimateIsMinimum: false,
    deposit: Money.fromCents(1500 * pairs),
    depositPayment: { method: "ZELLE", amount: Money.fromCents(1500 * pairs) },
    collection: null,
    submissionKey: null,
    submissionFingerprint: null,
    bundleId: null,
    alertBody: "Jordan · Standard Clean · Mail-In",
    items: Array.from({ length: pairs }, pair),
  };
  const { order } = await orders.create(input);
  return { orders, order };
}

describe("confirmPayment", () => {
  it("settles the PENDING Deposit and audits each live pair without moving its status", async () => {
    const { orders, order } = await bookOrder(3);
    order.items[2]!.status = "CANCELLED";

    const result = await confirmPayment({ orders }, ADMIN, { paymentId: order.payments[0]!.id, method: "ZELLE", idempotencyKey: "k1" });

    expect(result).toBe("confirmed");
    expect(order.payments[0]).toMatchObject({ status: "RECEIVED", receivedAt: expect.any(Date) });
    expect(order.items.map((item) => item.status)).toEqual(["REQUEST_SUBMITTED", "REQUEST_SUBMITTED", "CANCELLED"]);
    expect(orders.auditEntries).toEqual([
      expect.objectContaining({
        itemId: order.items[0]!.id,
        action: "MANUAL_PAYMENT_CONFIRMED",
        fromStatus: "REQUEST_SUBMITTED",
        toStatus: "REQUEST_SUBMITTED",
        actorAccountId: "acc_admin",
        idempotencyKey: "k1",
      }),
      expect.objectContaining({ itemId: order.items[1]!.id, action: "MANUAL_PAYMENT_CONFIRMED" }),
    ]);
    expect(await orders.listAwaitingPayments()).toEqual([]);
  });

  it("is idempotent: a retry with the same key changes nothing and is not an error", async () => {
    const { orders, order } = await bookOrder();
    await confirmPayment({ orders }, ADMIN, { paymentId: order.payments[0]!.id, method: "ZELLE", idempotencyKey: "k1" });
    const receivedAt = order.payments[0]!.receivedAt;

    const retry = await confirmPayment({ orders }, ADMIN, { paymentId: order.payments[0]!.id, method: "ZELLE", idempotencyKey: "k1" });

    expect(retry).toBe("already-confirmed");
    expect(orders.auditEntries).toHaveLength(1);
    expect(order.payments[0]!.receivedAt).toBe(receivedAt);
  });

  it("refuses a different key once the Deposit is settled, having written nothing", async () => {
    const { orders, order } = await bookOrder();
    await confirmPayment({ orders }, ADMIN, { paymentId: order.payments[0]!.id, method: "ZELLE", idempotencyKey: "k1" });

    await expect(confirmPayment({ orders }, ADMIN, { paymentId: order.payments[0]!.id, method: "ZELLE", idempotencyKey: "k2" })).rejects.toThrow(NoPendingPaymentError);
    expect(orders.auditEntries).toHaveLength(1);
  });

  it("refuses an Order whose pairs are all cancelled, or that doesn't exist", async () => {
    const { orders, order } = await bookOrder();
    order.items[0]!.status = "CANCELLED";

    await expect(confirmPayment({ orders }, ADMIN, { paymentId: order.payments[0]!.id, method: "ZELLE", idempotencyKey: "k1" })).rejects.toThrow(NoPendingPaymentError);
    await expect(confirmPayment({ orders }, ADMIN, { paymentId: "payment_missing", method: "ZELLE", idempotencyKey: "k1" })).rejects.toThrow(NoPendingPaymentError);
    expect(order.payments[0]!.status).toBe("PENDING");
  });

  it("is admin-only", async () => {
    const { orders, order } = await bookOrder();
    for (const user of [{ accountId: null, role: "GUEST" }, { accountId: order.accountId, role: "CUSTOMER" }] as ActingUser[]) {
      await expect(confirmPayment({ orders }, user, { paymentId: order.payments[0]!.id, method: "ZELLE", idempotencyKey: "k1" })).rejects.toThrow(UnauthorizedError);
    }
    expect(order.payments[0]!.status).toBe("PENDING");
  });

  it("settles a Balance too, by the method the owner says it arrived by, and keeps the status of every pair", async () => {
    const { orders, order } = await bookOrder();
    order.payments[0]!.status = "RECEIVED";
    order.payments.push({ id: "pay_balance", kind: "BALANCE", method: "ZELLE", amount: Money.fromCents(2500), status: "PENDING", receivedAt: null, createdAt: new Date() });
    order.items[0]!.status = "READY_FOR_PICKUP_SHIPPING";

    expect(await confirmPayment({ orders }, ADMIN, { paymentId: "pay_balance", method: "CASH", idempotencyKey: "k9" })).toBe("confirmed");

    expect(order.payments[1]).toMatchObject({ status: "RECEIVED", method: "CASH", receivedAt: expect.any(Date) });
    expect(order.items[0]!.status).toBe("READY_FOR_PICKUP_SHIPPING");
    expect(orders.auditEntries).toEqual([
      expect.objectContaining({ action: "MANUAL_PAYMENT_CONFIRMED", idempotencyKey: "k9", metadata: { paymentId: "pay_balance", kind: "BALANCE", method: "CASH" } }),
    ]);
    expect(await confirmPayment({ orders }, ADMIN, { paymentId: "pay_balance", method: "CASH", idempotencyKey: "k9" })).toBe("already-confirmed");
  });

  it("only takes Zelle or Cash, having written nothing", async () => {
    const { orders, order } = await bookOrder();
    await expect(confirmPayment({ orders }, ADMIN, { paymentId: order.payments[0]!.id, method: "CARD", idempotencyKey: "k1" })).rejects.toThrow(InvalidPaymentMethodError);
    expect(order.payments[0]!.status).toBe("PENDING");
  });
});
