import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { InMemoryOrderRepository } from "../repositories/in-memory-order-repository";
import { OrderNotFoundError } from "../repositories/order-repository";
import { cancelOrder, OrderNotCancellableError } from "./cancel-order";
import { submitOrder } from "./submit-order";
import { validPair, bookingDeps, RecordingNotificationService, validBookingInput } from "./test-fixtures";

const ADMIN = { accountId: "acc_admin", role: "ADMIN" as const };

async function booked() {
  const orders = new InMemoryOrderRepository();
  const notifications = new RecordingNotificationService();
  const order = await submitOrder(bookingDeps({ orders }), { accountId: null, role: "GUEST" }, validBookingInput());
  return { deps: { orders, notifications }, order };
}

describe("cancelOrder", () => {
  it("is admin-only, before it reads anything", async () => {
    const { deps, order } = await booked();
    await expect(cancelOrder(deps, { accountId: null, role: "GUEST" }, { orderId: order.id, idempotencyKey: "k" })).rejects.toThrow(UnauthorizedError);
    await expect(cancelOrder(deps, { accountId: "acc_c", role: "CUSTOMER" }, { orderId: "nope", idempotencyKey: "k" })).rejects.toThrow(UnauthorizedError);
  });

  it("cancels every live pair, audited, and a replay changes nothing", async () => {
    const { deps, order } = await booked();
    expect(await cancelOrder(deps, ADMIN, { orderId: order.id, idempotencyKey: "k" })).toBe("cancelled");
    const after = (await deps.orders.findById(order.id))!;
    expect(after.items.every((item) => item.status === "CANCELLED")).toBe(true);
    const audits = deps.orders.auditEntries.filter((entry) => entry.toStatus === "CANCELLED").length;
    expect(audits).toBe(order.items.length);

    expect(await cancelOrder(deps, ADMIN, { orderId: order.id, idempotencyKey: "k" })).toBe("already-cancelled");
    expect(deps.orders.auditEntries.filter((entry) => entry.toStatus === "CANCELLED")).toHaveLength(audits);
  });

  it("sends one whole-order email for a 3-pair cancel, none on a replay", async () => {
    const orders = new InMemoryOrderRepository();
    const notifications = new RecordingNotificationService();
    const order = await submitOrder(
      bookingDeps({ orders }),
      { accountId: null, role: "GUEST" },
      validBookingInput({ bundleId: "revival", items: [0, 1, 2].map((photo) => validPair({ serviceIds: [] }, photo)) }),
    );
    expect(order.items).toHaveLength(3);
    const deps = { orders, notifications };
    await cancelOrder(deps, ADMIN, { orderId: order.id, idempotencyKey: "k" });
    expect(notifications.sent).toHaveLength(1);
    expect(notifications.sent[0]!.subject).toMatch(/booking .* was cancelled/);
    await cancelOrder(deps, ADMIN, { orderId: order.id, idempotencyKey: "k" });
    expect(notifications.sent).toHaveLength(1);
  });

  it("refuses an Order that's all Completed, and an unknown one", async () => {
    const { deps, order } = await booked();
    for (const item of deps.orders.orders.get(order.id)!.items) item.status = "COMPLETED";
    await expect(cancelOrder(deps, ADMIN, { orderId: order.id, idempotencyKey: "k" })).rejects.toThrow(OrderNotCancellableError);
    await expect(cancelOrder(deps, ADMIN, { orderId: "nope", idempotencyKey: "k" })).rejects.toThrow(OrderNotFoundError);
  });
});
