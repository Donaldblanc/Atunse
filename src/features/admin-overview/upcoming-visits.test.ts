import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { InMemoryOrderRepository } from "@/features/orders/repositories/in-memory-order-repository";
import { submitOrder } from "@/features/orders/use-cases/submit-order";
import { bookingDeps, FIXED_NOW, validBookingInput, validPair } from "@/features/orders/use-cases/test-fixtures";
import { getUpcomingVisits } from "./upcoming-visits";

const ADMIN = { accountId: "acc_admin", role: "ADMIN" as const };

let photo = 0; // each booking needs its own photo
async function withVisit(orders: InMemoryOrderRepository, startsAt: string) {
  const order = await submitOrder(bookingDeps({ orders, accounts: orders.accounts }), { accountId: null, role: "GUEST" }, validBookingInput({ items: [validPair({}, photo++)] }));
  const stored = orders.orders.get(order.id)!;
  stored.appointments = [{ id: `appt_${startsAt}`, kind: "COLLECTION", status: "SCHEDULED", startsAt: new Date(startsAt), endsAt: new Date(new Date(startsAt).getTime() + 30 * 60_000), notes: null }];
  return stored;
}

describe("getUpcomingVisits", () => {
  it("is admin-only", async () => {
    const orders = new InMemoryOrderRepository();
    await expect(getUpcomingVisits({ orders }, { accountId: null, role: "GUEST" }, FIXED_NOW)).rejects.toThrow(UnauthorizedError);
  });

  it("lists the next 14 days of scheduled visits, and nothing past them", async () => {
    const orders = new InMemoryOrderRepository();
    await withVisit(orders, "2026-10-03T20:30:00Z"); // Oct 3, 4:30 PM in New York
    await withVisit(orders, "2026-10-14T20:30:00Z"); // day 14 from Oct 1: still in
    await withVisit(orders, "2026-10-15T20:30:00Z"); // day 15: out
    await withVisit(orders, "2026-09-30T20:30:00Z"); // yesterday: out

    const visits = await getUpcomingVisits({ orders }, ADMIN, FIXED_NOW);
    expect(visits.map((visit) => visit.day)).toEqual(["Sat, Oct 3", "Wed, Oct 14"]);
    expect(visits[0]).toMatchObject({ time: "4:30 PM", kind: "COLLECTION", customerName: "Jordan Smith" });
  });

  it("leaves out the visits of a fully cancelled Order", async () => {
    const orders = new InMemoryOrderRepository();
    const stored = await withVisit(orders, "2026-10-03T20:30:00Z");
    for (const item of stored.items) item.status = "CANCELLED";
    expect(await getUpcomingVisits({ orders }, ADMIN, FIXED_NOW)).toEqual([]);
  });
});
