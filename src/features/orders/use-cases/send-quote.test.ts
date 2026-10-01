import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { InMemoryOrderRepository } from "../repositories/in-memory-order-repository";
import { ItemNotFoundError, ItemStatusChangedError } from "../repositories/order-repository";
import { recordApproval } from "./record-approval";
import { InvalidQuoteError, sendQuote } from "./send-quote";
import { submitOrder } from "./submit-order";
import { bookingDeps, RecordingNotificationService, validBookingInput, validBundleInput } from "./test-fixtures";

const admin = { accountId: "acc_admin", role: "ADMIN" as const };

async function seed(pairs = 1) {
  const orders = new InMemoryOrderRepository();
  const notifications = new RecordingNotificationService();
  const order = await submitOrder(
    bookingDeps({ orders }),
    { accountId: null, role: "GUEST" },
    // Only a Bundle books several pairs (three).
    pairs === 3 ? validBundleInput() : validBookingInput(),
  );
  for (const item of order.items) {
    await orders.transitionItemStatus({
      itemId: item.id,
      toStatus: "UNDER_REVIEW",
      entry: { action: "STATUS_TRANSITION", fromStatus: "REQUEST_SUBMITTED", toStatus: "UNDER_REVIEW", actorAccountId: null, idempotencyKey: null },
    });
  }
  return { orders, notifications, order, deps: { orders, notifications } };
}

describe("sendQuote", () => {
  it("rejects a non-admin caller", async () => {
    const { deps, order } = await seed();
    await expect(sendQuote(deps, { accountId: "acc_1", role: "CUSTOMER" }, { itemId: order.items[0]!.id, priceCents: 9000, idempotencyKey: "k" })).rejects.toThrow(UnauthorizedError);
  });

  it("sets the price and status, audits the price and who sent it, and emails the customer", async () => {
    const { deps, orders, notifications, order } = await seed();
    const itemId = order.items[0]!.id;

    const result = await sendQuote(deps, admin, { itemId, priceCents: 9050, idempotencyKey: "k1" });

    expect(result).toEqual({ status: "sent", emailFailed: false });
    const item = orders.orders.get(order.id)!.items[0]!;
    expect(item).toMatchObject({ status: "QUOTE_SENT" });
    expect(item.price?.cents).toBe(9050);
    expect(orders.auditEntries.find((entry) => entry.action === "QUOTE_SENT")).toMatchObject({
      itemId,
      fromStatus: "UNDER_REVIEW",
      toStatus: "QUOTE_SENT",
      actorAccountId: "acc_admin",
      metadata: { priceCents: 9050 },
    });
    expect(notifications.sent).toHaveLength(1);
    expect(notifications.sent[0]).toMatchObject({ to: "customer@example.com", subject: `Your quote for ATU-${order.number}` });
    expect(notifications.sent[0]!.body).toContain("$90.50");
  });

  it("is idempotent: a replay writes nothing and sends no second email", async () => {
    const { deps, notifications, order } = await seed();
    const input = { itemId: order.items[0]!.id, priceCents: 9000, idempotencyKey: "k1" };
    await sendQuote(deps, admin, input);
    expect(await sendQuote(deps, admin, { ...input, priceCents: 100 })).toEqual({ status: "already-sent" });
    expect(notifications.sent).toHaveLength(1);
  });

  it("refuses a pair that isn't Under Review, having sent nothing", async () => {
    const { deps, notifications, order } = await seed();
    const itemId = order.items[0]!.id;
    await sendQuote(deps, admin, { itemId, priceCents: 9000, idempotencyKey: "k1" });
    await expect(sendQuote(deps, admin, { itemId, priceCents: 9500, idempotencyKey: "k2" })).rejects.toThrow(ItemStatusChangedError);
    expect(notifications.sent).toHaveLength(1);
  });

  it("refuses a missing pair", async () => {
    const { deps } = await seed();
    await expect(sendQuote(deps, admin, { itemId: "nope", priceCents: 9000, idempotencyKey: "k" })).rejects.toThrow(ItemNotFoundError);
  });

  it.each([0, -100, 1, 99, 12.5, Number.NaN, 500_001])("refuses the price %s without writing", async (priceCents) => {
    const { deps, orders, order } = await seed();
    await expect(sendQuote(deps, admin, { itemId: order.items[0]!.id, priceCents, idempotencyKey: "k" })).rejects.toThrow(InvalidQuoteError);
    expect(orders.orders.get(order.id)!.items[0]!.status).toBe("UNDER_REVIEW");
  });

  it("keeps the quote and says so when the email can't be sent", async () => {
    const { deps, notifications, orders, order } = await seed();
    notifications.failing = true;
    const result = await sendQuote(deps, admin, { itemId: order.items[0]!.id, priceCents: 9000, idempotencyKey: "k" });
    expect(result).toEqual({ status: "sent", emailFailed: true });
    expect(orders.orders.get(order.id)!.items[0]!.status).toBe("QUOTE_SENT");
  });

  it("quotes each pair of a multi-pair Order on its own, telling the customer the total so far", async () => {
    const { deps, notifications, orders, order } = await seed(3);
    await sendQuote(deps, admin, { itemId: order.items[0]!.id, priceCents: 6000, idempotencyKey: "a" });
    expect(orders.orders.get(order.id)!.items.map((item) => item.status)).toEqual(["QUOTE_SENT", "UNDER_REVIEW", "UNDER_REVIEW"]);
    expect(notifications.sent[0]!.body).toContain("across 1 of 3 pairs");

    await sendQuote(deps, admin, { itemId: order.items[1]!.id, priceCents: 7000, idempotencyKey: "b" });
    await sendQuote(deps, admin, { itemId: order.items[2]!.id, priceCents: 8000, idempotencyKey: "c" });
    expect(notifications.sent[2]!.body).toContain("for a total of $210");
  });
});

describe("recordApproval", () => {
  it("rejects a non-admin caller", async () => {
    const { orders, order } = await seed();
    await expect(recordApproval({ orders }, { accountId: "acc_1", role: "CUSTOMER" }, { itemId: order.items[0]!.id, idempotencyKey: "k" })).rejects.toThrow(UnauthorizedError);
  });

  it("moves Quote Sent to Approved and records who recorded it, once", async () => {
    const { deps, orders, order } = await seed();
    const itemId = order.items[0]!.id;
    await sendQuote(deps, admin, { itemId, priceCents: 9000, idempotencyKey: "q" });

    expect(await recordApproval({ orders }, admin, { itemId, idempotencyKey: "a" })).toBe("recorded");
    expect(await recordApproval({ orders }, admin, { itemId, idempotencyKey: "a" })).toBe("already-recorded");

    expect(orders.orders.get(order.id)!.items[0]!.status).toBe("APPROVED");
    expect(orders.auditEntries.filter((entry) => entry.action === "APPROVAL_RECORDED")).toEqual([
      expect.objectContaining({ itemId, fromStatus: "QUOTE_SENT", toStatus: "APPROVED", actorAccountId: "acc_admin" }),
    ]);
  });

  it("refuses a pair that hasn't been quoted", async () => {
    const { orders, order } = await seed();
    await expect(recordApproval({ orders }, admin, { itemId: order.items[0]!.id, idempotencyKey: "a" })).rejects.toThrow(ItemStatusChangedError);
  });
});
