import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { Money } from "@/shared/money/money";
import { InMemoryOrderRepository } from "../repositories/in-memory-order-repository";
import { OrderNotFoundError } from "../repositories/order-repository";
import { createBalance } from "./create-balance";
import { submitOrder } from "./submit-order";
import { bookingDeps, validBookingInput } from "./test-fixtures";

const admin = { accountId: "acc_admin", role: "ADMIN" as const };

/** An Order that was ready before Balances were recorded: Ready and quoted, but with no Balance row. */
async function legacyReadyOrder() {
  const orders = new InMemoryOrderRepository();
  const order = await submitOrder(bookingDeps({ orders }), { accountId: null, role: "GUEST" }, validBookingInput());
  const stored = orders.orders.get(order.id)!;
  stored.items[0]!.status = "READY_FOR_PICKUP_SHIPPING";
  stored.items[0]!.price = Money.fromCents(20000);
  stored.payments[0]!.status = "RECEIVED";
  return { orders, stored };
}

describe("createBalance", () => {
  it("is admin-only", async () => {
    const { orders, stored } = await legacyReadyOrder();
    await expect(createBalance({ orders }, { accountId: "acc_c", role: "CUSTOMER" }, { orderId: stored.id })).rejects.toThrow(UnauthorizedError);
    expect(stored.payments).toHaveLength(1);
  });

  it("creates the missing Balance once, and does nothing on a repeat", async () => {
    const { orders, stored } = await legacyReadyOrder();
    const deposit = stored.payments[0]!;

    expect(await createBalance({ orders }, admin, { orderId: stored.id })).toBe("created");
    expect(await createBalance({ orders }, admin, { orderId: stored.id })).toBe("none");

    const balances = stored.payments.filter((payment) => payment.kind === "BALANCE");
    expect(balances).toEqual([expect.objectContaining({ status: "PENDING", amount: Money.fromCents(20000).subtract(deposit.amount) })]);
  });

  it("does nothing while a live pair isn't ready, or when the Deposit covers the total", async () => {
    const early = await legacyReadyOrder();
    early.stored.items[0]!.status = "QUALITY_CHECK";
    expect(await createBalance({ orders: early.orders }, admin, { orderId: early.stored.id })).toBe("none");

    const covered = await legacyReadyOrder();
    covered.stored.items[0]!.price = Money.fromCents(100);
    expect(await createBalance({ orders: covered.orders }, admin, { orderId: covered.stored.id })).toBe("none");
    expect(covered.stored.payments).toHaveLength(1);
  });

  it("refuses an Order that doesn't exist", async () => {
    await expect(createBalance({ orders: new InMemoryOrderRepository() }, admin, { orderId: "missing" })).rejects.toThrow(OrderNotFoundError);
  });
});
