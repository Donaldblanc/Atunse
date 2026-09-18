import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { ConsoleNotificationService } from "@/features/notifications/notification-service";
import { InMemoryOrderRepository } from "../repositories/in-memory-order-repository";
import { PolicyNotAcceptedError, submitOrder } from "./submit-order";

function deps() {
  return { orders: new InMemoryOrderRepository(), notifications: new ConsoleNotificationService() };
}

const validInput = {
  guestEmail: "customer@example.com",
  guestPhone: null,
  policyAccepted: true,
  item: { brand: "Nike", model: "Air Max", description: "scuffed sole", photoKeys: ["k1"] },
};

describe("submitOrder", () => {
  it("creates an order with one REQUEST_SUBMITTED item as a guest", async () => {
    const order = await submitOrder(deps(), { accountId: null, role: "GUEST" }, validInput);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]?.status).toBe("REQUEST_SUBMITTED");
  });

  it("rejects submission without policy acceptance", async () => {
    await expect(
      submitOrder(deps(), { accountId: null, role: "GUEST" }, { ...validInput, policyAccepted: false }),
    ).rejects.toThrow(PolicyNotAcceptedError);
  });

  it("rejects an admin trying to submit an order as themselves", async () => {
    await expect(
      submitOrder(deps(), { accountId: "acc_1", role: "ADMIN" }, validInput),
    ).rejects.toThrow(UnauthorizedError);
  });
});
