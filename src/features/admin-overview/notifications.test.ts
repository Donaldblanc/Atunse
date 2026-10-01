import { describe, expect, it } from "vitest";
import { UnauthorizedError, type ActingUser } from "@/features/accounts/authz";
import { InMemoryOrderRepository } from "@/features/orders/repositories/in-memory-order-repository";
import { InvalidNotificationIdsError, markNotificationsRead } from "./mark-notifications-read";
import { listNotifications } from "./list-notifications";
import { bookingDeps, validBookingInput, validPair } from "@/features/orders/use-cases/test-fixtures";
import { submitOrder } from "@/features/orders/use-cases/submit-order";

const ADMIN: ActingUser = { accountId: "acc_admin", role: "ADMIN" };
const CUSTOMER: ActingUser = { accountId: "acc_c", role: "CUSTOMER" };
const GUEST: ActingUser = { accountId: null, role: "GUEST" };

async function repoWithBookings(count: number) {
  const deps = bookingDeps();
  for (let i = 0; i < count; i++) {
    await submitOrder(deps, GUEST, validBookingInput({ items: [validPair({}, i)], contact: { name: "Jordan Smith", email: `c${i}@example.com`, phone: "(212) 555-0142" } }));
  }
  return deps.orders as InMemoryOrderRepository;
}

describe("listNotifications", () => {
  it("returns the latest 10, newest first, with the unread count across all", async () => {
    const orders = await repoWithBookings(12);
    const { notifications, unreadCount } = await listNotifications({ orders }, ADMIN);
    expect(notifications).toHaveLength(10);
    expect(unreadCount).toBe(12);
    expect(notifications[0]!.id).toBe(orders.notifications[11]!.id);
    expect(notifications[0]).toMatchObject({ kind: "NEW_BOOKING", readAt: null });
  });

  it.each([["customer", CUSTOMER], ["guest", GUEST]])("refuses a %s", async (_label, user) => {
    await expect(listNotifications({ orders: new InMemoryOrderRepository() }, user)).rejects.toThrow(UnauthorizedError);
  });
});

describe("markNotificationsRead", () => {
  const at = new Date("2026-10-02T12:00:00Z");

  it("marks the given ids read and leaves the rest", async () => {
    const orders = await repoWithBookings(3);
    await markNotificationsRead({ orders }, ADMIN, { ids: [orders.notifications[0]!.id] }, () => at);
    expect(orders.notifications.map((n) => n.readAt)).toEqual([at, null, null]);
    expect((await listNotifications({ orders }, ADMIN)).unreadCount).toBe(2);
  });

  it("marks all read, without changing the time of ones already read", async () => {
    const orders = await repoWithBookings(2);
    await markNotificationsRead({ orders }, ADMIN, { ids: [orders.notifications[0]!.id] }, () => at);
    const later = new Date("2026-10-03T12:00:00Z");
    await markNotificationsRead({ orders }, ADMIN, { all: true }, () => later);
    expect(orders.notifications.map((n) => n.readAt)).toEqual([at, later]);
  });

  it("refuses a non-admin before writing", async () => {
    const orders = await repoWithBookings(1);
    await expect(markNotificationsRead({ orders }, CUSTOMER, { all: true })).rejects.toThrow(UnauthorizedError);
    expect(orders.notifications[0]!.readAt).toBeNull();
  });

  it.each([
    ["none", []],
    ["an empty id", [""]],
    ["an id over 64 characters", ["x".repeat(65)]],
    ["more than 50 ids", Array.from({ length: 51 }, (_, i) => `id${i}`)],
    ["a non-string", [42 as unknown as string]],
  ])("refuses %s", async (_label, ids) => {
    const orders = await repoWithBookings(1);
    await expect(markNotificationsRead({ orders }, ADMIN, { ids })).rejects.toThrow(InvalidNotificationIdsError);
    expect(orders.notifications[0]!.readAt).toBeNull();
  });
});
