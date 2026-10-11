import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { InMemoryOrderRepository } from "@/features/orders/repositories/in-memory-order-repository";
import { submitOrder } from "@/features/orders/use-cases/submit-order";
import { bookingDeps, validBookingInput, validPair } from "@/features/orders/use-cases/test-fixtures";
import { getAdminCalendar } from "./get-admin-calendar";

const ADMIN = { accountId: "acc_admin", role: "ADMIN" as const };

let photo = 0; // each booking needs its own photo
async function withVisit(orders: InMemoryOrderRepository, startsAt: string) {
  const order = await submitOrder(bookingDeps({ orders, accounts: orders.accounts }), { accountId: null, role: "GUEST" }, validBookingInput({ items: [validPair({}, photo++)] }));
  const stored = orders.orders.get(order.id)!;
  stored.appointments = [{ id: `appt_${startsAt}`, kind: "COLLECTION", status: "SCHEDULED", startsAt: new Date(startsAt), endsAt: new Date(new Date(startsAt).getTime() + 30 * 60_000), notes: null }];
  return stored;
}

describe("getAdminCalendar", () => {
  it("is admin-only", async () => {
    const orders = new InMemoryOrderRepository();
    await expect(getAdminCalendar({ orders }, { accountId: null, role: "GUEST" }, "2026-10-01")).rejects.toThrow(UnauthorizedError);
  });

  it("groups the month's live, scheduled visits by the shop-time day they fall on", async () => {
    const orders = new InMemoryOrderRepository();
    await withVisit(orders, "2026-10-03T20:30:00Z"); // Oct 3, 4:30 PM in New York
    await withVisit(orders, "2026-10-31T23:30:00Z"); // Oct 31, 7:30 PM in New York
    await withVisit(orders, "2026-11-01T14:00:00Z"); // Nov 1: inside the grid (the trailing day of October's last week), even though it's not in October

    const calendar = await getAdminCalendar({ orders }, ADMIN, "2026-10-01");
    expect(calendar.grid.month).toBe("2026-10-01");
    expect(calendar.visitsByDay.get("2026-10-03")).toMatchObject([{ kind: "COLLECTION", time: "4:30 PM", customerName: "Jordan Smith" }]);
    expect(calendar.visitsByDay.get("2026-10-31")).toHaveLength(1);
    expect(calendar.visitsByDay.get("2026-11-01")).toHaveLength(1);
  });

  it("groups a visit crossing UTC midnight by its New York day, not UTC's", async () => {
    const orders = new InMemoryOrderRepository();
    // 10 PM Oct 3 in New York (EDT, UTC-4) is 2 AM Oct 4 in UTC.
    await withVisit(orders, "2026-10-04T02:00:00Z");

    const calendar = await getAdminCalendar({ orders }, ADMIN, "2026-10-01");
    expect(calendar.visitsByDay.get("2026-10-03")).toHaveLength(1);
    expect(calendar.visitsByDay.get("2026-10-04")).toBeUndefined();
  });

  it("excludes a visit just outside the grid", async () => {
    const orders = new InMemoryOrderRepository();
    // Nov 2, 2026 is the Monday right after October's grid ends (Nov 1).
    await withVisit(orders, "2026-11-02T14:00:00Z");

    const calendar = await getAdminCalendar({ orders }, ADMIN, "2026-10-01");
    expect(calendar.grid.days).not.toContain("2026-11-02");
    expect(calendar.visitsByDay.size).toBe(0);
  });

  it("leaves out the visits of a fully cancelled Order", async () => {
    const orders = new InMemoryOrderRepository();
    const stored = await withVisit(orders, "2026-10-03T20:30:00Z");
    for (const item of stored.items) item.status = "CANCELLED";
    const calendar = await getAdminCalendar({ orders }, ADMIN, "2026-10-01");
    expect(calendar.visitsByDay.get("2026-10-03")).toBeUndefined();
  });
});
