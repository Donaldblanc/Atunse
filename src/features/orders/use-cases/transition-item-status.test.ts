import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { ConsoleNotificationService } from "@/features/notifications/notification-service";
import { InMemoryOrderRepository } from "../repositories/in-memory-order-repository";
import { ItemNotFoundError, ItemStatusChangedError } from "../repositories/order-repository";
import { submitOrder } from "./submit-order";
import { bookingDeps, validBookingInput } from "./test-fixtures";
import { InvalidTransitionError, transitionItemStatus } from "./transition-item-status";

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

    const quoteSent = await transitionItemStatus(deps, admin, {
      itemId: item.id,
      fromStatus: "UNDER_REVIEW",
      toStatus: "QUOTE_SENT",
      action: "QUOTE_SENT",
    });
    expect(quoteSent?.status).toBe("QUOTE_SENT");
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
      toStatus: "QUOTE_SENT",
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
    // The item is REQUEST_SUBMITTED; a caller claiming it's QUOTE_SENT tries to approve it.
    await expect(
      transitionItemStatus(deps, admin, { itemId: item.id, fromStatus: "QUOTE_SENT", toStatus: "APPROVED", action: "APPROVED" }),
    ).rejects.toThrow(ItemStatusChangedError);
    expect(item.status).toBe("REQUEST_SUBMITTED");
  });
});
