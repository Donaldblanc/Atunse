import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { ConsoleNotificationService } from "@/features/notifications/notification-service";
import { InMemoryOrderRepository } from "../repositories/in-memory-order-repository";
import { submitOrder } from "./submit-order";
import { InvalidTransitionError, transitionItemStatus } from "./transition-item-status";

async function seedOrder(orders: InMemoryOrderRepository) {
  const order = await submitOrder(
    { orders, notifications: new ConsoleNotificationService() },
    { accountId: null, role: "GUEST" },
    {
      guestEmail: "customer@example.com",
      guestPhone: null,
      policyAccepted: true,
      item: { brand: "Nike", model: "Air Max", description: null, photoKeys: ["k1"] },
    },
  );
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
});
