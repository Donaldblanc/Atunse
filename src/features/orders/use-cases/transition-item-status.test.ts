import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { ConsoleNotificationService } from "@/features/notifications/notification-service";
import { InMemoryOrderRepository } from "../repositories/in-memory-order-repository";
import { ItemNotFoundError, ItemStatusChangedError } from "../repositories/order-repository";
import type { ItemStatus } from "../domain";
import { submitOrder } from "./submit-order";
import { bookingDeps, RecordingNotificationService, validBookingInput } from "./test-fixtures";
import { InvalidTransitionError, MoveNotAllowedError, transitionItemStatus } from "./transition-item-status";

async function seedOrder(orders: InMemoryOrderRepository) {
  const order = await submitOrder(bookingDeps({ orders }), { accountId: null, role: "GUEST" }, validBookingInput());
  return { order, item: order.items[0]! };
}

const admin = { accountId: "acc_admin", role: "ADMIN" as const };

describe("transitionItemStatus", () => {
  it("rejects a non-admin caller", async () => {
    const orders = new InMemoryOrderRepository();
    const { item } = await seedOrder(orders);
    await expect(
      transitionItemStatus(
        { orders, notifications: new ConsoleNotificationService() },
        { accountId: "acc_1", role: "CUSTOMER" },
        { itemId: item.id, fromStatus: "REQUEST_SUBMITTED", toStatus: "UNDER_REVIEW", action: "REVIEW_STARTED" },
      ),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("rejects skipping ahead in the pipeline", async () => {
    const orders = new InMemoryOrderRepository();
    const { item } = await seedOrder(orders);
    await expect(
      transitionItemStatus(
        { orders, notifications: new ConsoleNotificationService() },
        admin,
        { itemId: item.id, fromStatus: "REQUEST_SUBMITTED", toStatus: "APPROVED", action: "SKIP" },
      ),
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("advances the pipeline step by step and records each transition", async () => {
    const orders = new InMemoryOrderRepository();
    const { item } = await seedOrder(orders);
    const deps = { orders, notifications: new ConsoleNotificationService() };

    const underReview = await transitionItemStatus(deps, admin, {
      itemId: item.id,
      fromStatus: "REQUEST_SUBMITTED",
      toStatus: "UNDER_REVIEW",
      action: "REVIEW_STARTED",
    });
    expect(underReview?.status).toBe("UNDER_REVIEW");

    const cancelled = await transitionItemStatus(deps, admin, {
      itemId: item.id,
      fromStatus: "UNDER_REVIEW",
      toStatus: "CANCELLED",
      action: "STATUS_TRANSITION",
    });
    expect(cancelled?.status).toBe("CANCELLED");
  });

  it("is idempotent: retrying the same manual-payment confirmation does not double-apply", async () => {
    const orders = new InMemoryOrderRepository();
    const { item } = await seedOrder(orders);
    const deps = { orders, notifications: new ConsoleNotificationService() };
    const key = "payment-confirm-click-1";

    const first = await transitionItemStatus(deps, admin, {
      itemId: item.id,
      fromStatus: "REQUEST_SUBMITTED",
      toStatus: "UNDER_REVIEW",
      action: "MANUAL_PAYMENT_CONFIRMED",
      idempotencyKey: key,
    });
    const retry = await transitionItemStatus(deps, admin, {
      itemId: item.id,
      fromStatus: "REQUEST_SUBMITTED",
      toStatus: "UNDER_REVIEW",
      action: "MANUAL_PAYMENT_CONFIRMED",
      idempotencyKey: key,
    });

    expect(first?.status).toBe("UNDER_REVIEW");
    expect(retry).toBeNull(); // already applied — not an error, not a double-transition
  });

  it("settles the Order's Deposit Payment when a payment is confirmed, and only then", async () => {
    const orders = new InMemoryOrderRepository();
    const { order, item } = await seedOrder(orders);
    const deps = { orders, notifications: new ConsoleNotificationService() };
    const deposit = () => orders.orders.get(order.id)!.payments.find((payment) => payment.kind === "DEPOSIT")!;
    expect(deposit().status).toBe("PENDING");

    await transitionItemStatus(deps, admin, { itemId: item.id, fromStatus: "REQUEST_SUBMITTED", toStatus: "UNDER_REVIEW", action: "REVIEW_STARTED" });
    expect(deposit().status).toBe("PENDING");

    await transitionItemStatus(deps, admin, {
      itemId: item.id,
      fromStatus: "UNDER_REVIEW",
      toStatus: "CANCELLED",
      action: "MANUAL_PAYMENT_CONFIRMED",
      idempotencyKey: "confirm-1",
    });
    expect(deposit()).toMatchObject({ status: "RECEIVED", receivedAt: expect.any(Date) });
  });

  it("returns an Item from Under Review to Request Submitted, recorded like any transition", async () => {
    const orders = new InMemoryOrderRepository();
    const { item } = await seedOrder(orders);
    const deps = { orders, notifications: new ConsoleNotificationService() };
    await transitionItemStatus(deps, admin, { itemId: item.id, fromStatus: "REQUEST_SUBMITTED", toStatus: "UNDER_REVIEW", action: "REVIEW_STARTED" });

    const reverted = await transitionItemStatus(deps, admin, {
      itemId: item.id,
      fromStatus: "UNDER_REVIEW",
      toStatus: "REQUEST_SUBMITTED",
      action: "REVIEW_REVERTED",
    });

    expect(reverted?.status).toBe("REQUEST_SUBMITTED");
    expect(orders.auditEntries.at(-1)).toMatchObject({ action: "REVIEW_REVERTED", fromStatus: "UNDER_REVIEW", toStatus: "REQUEST_SUBMITTED", actorAccountId: "acc_admin" });
  });

  it("refuses an item that doesn't exist, instead of reporting it as already applied", async () => {
    const orders = new InMemoryOrderRepository();
    await expect(
      transitionItemStatus(
        { orders, notifications: new ConsoleNotificationService() },
        admin,
        { itemId: "item_missing", fromStatus: "REQUEST_SUBMITTED", toStatus: "UNDER_REVIEW", action: "REVIEW_STARTED" },
      ),
    ).rejects.toThrow(ItemNotFoundError);
  });

  it("refuses a stale fromStatus, so a step can't be skipped, and leaves the item as it was", async () => {
    const orders = new InMemoryOrderRepository();
    const { item } = await seedOrder(orders);
    const deps = { orders, notifications: new ConsoleNotificationService() };
    // The item is REQUEST_SUBMITTED; a caller claiming it's IN_PROGRESS tries to move it on.
    await expect(
      transitionItemStatus(deps, admin, { itemId: item.id, fromStatus: "IN_PROGRESS", toStatus: "QUALITY_CHECK", action: "STATUS_TRANSITION" }),
    ).rejects.toThrow(ItemStatusChangedError);
    expect(item.status).toBe("REQUEST_SUBMITTED");
  });
});

describe("transitionItemStatus: what plain Update Status may do, and who is told", () => {
  async function seedAt(status: ItemStatus) {
    const orders = new InMemoryOrderRepository();
    const notifications = new RecordingNotificationService();
    const { order, item } = await seedOrder(orders);
    orders.orders.get(order.id)!.items[0]!.status = status;
    return { orders, notifications, order, item, deps: { orders, notifications } };
  }

  it("refuses Quote Sent and Approved, which have their own steps", async () => {
    const underReview = await seedAt("UNDER_REVIEW");
    await expect(
      transitionItemStatus(underReview.deps, admin, { itemId: underReview.item.id, fromStatus: "UNDER_REVIEW", toStatus: "QUOTE_SENT", action: "QUOTE_SENT" }),
    ).rejects.toThrow(MoveNotAllowedError);
    const quoted = await seedAt("QUOTE_SENT");
    await expect(
      transitionItemStatus(quoted.deps, admin, { itemId: quoted.item.id, fromStatus: "QUOTE_SENT", toStatus: "APPROVED", action: "APPROVED" }),
    ).rejects.toThrow(MoveNotAllowedError);
    expect(quoted.orders.orders.get(quoted.order.id)!.items[0]!.status).toBe("QUOTE_SENT");
  });

  it("holds a pair at Approved until the Deposit is paid, saying why", async () => {
    const { deps, item } = await seedAt("APPROVED");
    await expect(
      transitionItemStatus(deps, admin, { itemId: item.id, fromStatus: "APPROVED", toStatus: "AWAITING_SNEAKERS", action: "STATUS_TRANSITION" }),
    ).rejects.toThrow(/deposit/);
  });

  it("lets the payment confirmation itself move a pair past Approved, settling the Deposit", async () => {
    const { deps, orders, order, item } = await seedAt("APPROVED");
    const moved = await transitionItemStatus(deps, admin, {
      itemId: item.id,
      fromStatus: "APPROVED",
      toStatus: "AWAITING_SNEAKERS",
      action: "MANUAL_PAYMENT_CONFIRMED",
      idempotencyKey: "confirm-1",
    });
    expect(moved?.status).toBe("AWAITING_SNEAKERS");
    expect(orders.orders.get(order.id)!.payments.find((payment) => payment.kind === "DEPOSIT")!.status).toBe("RECEIVED");
  });

  it("emails the customer when a pair is ready, once, and stays silent on an idempotent replay", async () => {
    const { deps, notifications, item } = await seedAt("QUALITY_CHECK");
    const move = () =>
      transitionItemStatus(deps, admin, { itemId: item.id, fromStatus: "QUALITY_CHECK", toStatus: "READY_FOR_PICKUP_SHIPPING", action: "STATUS_TRANSITION", idempotencyKey: "k" });
    await move();
    expect(await move()).toBeNull();
    expect(notifications.sent).toHaveLength(1);
    expect(notifications.sent[0]).toMatchObject({ to: "customer@example.com" });
    expect(notifications.sent[0]!.body).toContain("Local Drop-Off");
  });

  it("emails a cancellation, and keeps quiet at internal steps", async () => {
    const quiet = await seedAt("IN_PROGRESS");
    await transitionItemStatus(quiet.deps, admin, { itemId: quiet.item.id, fromStatus: "IN_PROGRESS", toStatus: "QUALITY_CHECK", action: "STATUS_TRANSITION" });
    expect(quiet.notifications.sent).toEqual([]);

    const cancelling = await seedAt("UNDER_REVIEW");
    await transitionItemStatus(cancelling.deps, admin, { itemId: cancelling.item.id, fromStatus: "UNDER_REVIEW", toStatus: "CANCELLED", action: "STATUS_TRANSITION" });
    expect(cancelling.notifications.sent).toHaveLength(1);
    expect(cancelling.notifications.sent[0]!.subject).toMatch(/cancelled/);
  });

  it("keeps the status change when the email can't be sent", async () => {
    const { deps, notifications, orders, order, item } = await seedAt("UNDER_REVIEW");
    notifications.failing = true;
    await transitionItemStatus(deps, admin, { itemId: item.id, fromStatus: "UNDER_REVIEW", toStatus: "CANCELLED", action: "STATUS_TRANSITION" });
    expect(orders.orders.get(order.id)!.items[0]!.status).toBe("CANCELLED");
  });
});
