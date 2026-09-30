import { describe, expect, it } from "vitest";
import { UnauthorizedError, type ActingUser } from "@/features/accounts/authz";
import { InMemoryOrderRepository } from "@/features/orders/repositories/in-memory-order-repository";
import type { NewItemInput, NewOrderInput } from "@/features/orders/repositories/order-repository";
import { Money } from "@/shared/money/money";
import { getAdminOverview, percentChange } from "./get-admin-overview";

// Tuesday Sep 29, 2026, 10:00 AM in New York: "this week" is Sep 28 - Oct 4.
const NOW = new Date("2026-09-29T14:00:00Z");
const ADMIN: ActingUser = { accountId: "acc_admin", role: "ADMIN" };

let counter = 0;
function item(serviceIds: string[]): NewItemInput {
  counter += 1;
  return {
    brand: null,
    model: null,
    description: null,
    material: null,
    serviceIds,
    estimate: Money.fromCents(3000),
    photos: [{ key: `photos/${counter}.jpg`, uploadKey: `bookings/${counter}.jpg` }],
  };
}

function order(estimateCents: number, items: NewItemInput[] = [item(["standard"])]): NewOrderInput {
  counter += 1;
  return {
    owner: { newCustomer: { email: `c${counter}@example.com`, phone: "2125550142" } },
    contactName: "Jordan Smith",
    contactEmail: `c${counter}@example.com`,
    contactPhone: "2125550142",
    policyAcceptedAt: NOW,
    terms: { version: "v1", url: "/terms.pdf", sha256: "x", acknowledgments: {} },
    fulfillment: { method: "MAIL_IN", address: { line1: "1 Main St", line2: null, city: "Austin", state: "TX", zip: "73301" }, preferredDate: null },
    rush: false,
    estimate: Money.fromCents(estimateCents),
    estimateIsMinimum: false,
    deposit: Money.fromCents(estimateCents / 2),
    submissionKey: null,
    submissionFingerprint: null,
    bundleId: null,
    items,
  };
}

/** Books an Order as if it were submitted at `createdAt`. */
async function book(orders: InMemoryOrderRepository, createdAt: string, input: NewOrderInput) {
  const { order } = await orders.create(input);
  order.createdAt = new Date(createdAt);
  return order;
}

function deps() {
  const orders = new InMemoryOrderRepository();
  return { orders, now: () => NOW };
}

describe("getAdminOverview", () => {
  it("is admin-only", async () => {
    await expect(getAdminOverview(deps(), { accountId: "acc_c", role: "CUSTOMER" }, "this-week")).rejects.toThrow(UnauthorizedError);
    await expect(getAdminOverview(deps(), { accountId: null, role: "GUEST" }, "this-week")).rejects.toThrow(UnauthorizedError);
  });

  it("counts this week's Orders and booked revenue against the same stretch of last week", async () => {
    const d = deps();
    await book(d.orders, "2026-09-28T13:00:00Z", order(3000)); // Mon 9 AM
    await book(d.orders, "2026-09-29T13:30:00Z", order(8000)); // Tue 9:30 AM
    await book(d.orders, "2026-09-22T13:00:00Z", order(5000)); // last Tue 9 AM: counted before
    await book(d.orders, "2026-09-22T20:00:00Z", order(9000)); // last Tue 4 PM: after the same point last week

    const overview = await getAdminOverview(d, ADMIN, "this-week");

    expect(overview.orders).toEqual({ current: 2, previous: 1 });
    expect(overview.bookedRevenue.current.cents).toBe(11000);
    expect(overview.bookedRevenue.previous.cents).toBe(5000);
    expect(overview.revenueByDay.map((day) => day.revenue.cents)).toEqual([3000, 8000, 0, 0, 0, 0, 0]);
  });

  it("buckets revenue by New York's day, not UTC's", async () => {
    const d = deps();
    // 11:30 PM Monday in New York is already Tuesday in UTC.
    await book(d.orders, "2026-09-29T03:30:00Z", order(4000));

    const overview = await getAdminOverview(d, ADMIN, "this-week");

    expect(overview.revenueByDay[0]).toEqual({ date: "2026-09-28", revenue: Money.fromCents(4000) });
  });

  it("leaves fully cancelled Orders and cancelled pairs out", async () => {
    const d = deps();
    const cancelled = await book(d.orders, "2026-09-28T13:00:00Z", order(3000));
    cancelled.items[0]!.status = "CANCELLED";
    const partly = await book(d.orders, "2026-09-28T14:00:00Z", order(9000, [item(["premium", "laces"]), item(["standard"])]));
    partly.items[1]!.status = "CANCELLED";

    const overview = await getAdminOverview(d, ADMIN, "this-week");

    expect(overview.orders.current).toBe(1);
    expect(overview.bookedRevenue.current.cents).toBe(9000);
    expect(overview.servicesBooked).toEqual([
      { serviceId: "premium", name: "Premium Clean", count: 1 },
      { serviceId: "laces", name: "Lace Replacement", count: 1 },
    ]);
  });

  it("counts Services per pair, in catalog order", async () => {
    const d = deps();
    await book(d.orders, "2026-09-28T13:00:00Z", order(12000, [item(["laces", "standard"]), item(["standard"]), item(["premium", "oxidation"])]));

    const overview = await getAdminOverview(d, ADMIN, "this-week");

    expect(overview.servicesBooked.map((s) => [s.serviceId, s.count])).toEqual([
      ["standard", 2],
      ["premium", 1],
      ["oxidation", 1],
      ["laces", 1],
    ]);
  });

  it("reports the work queues as they stand now, whatever the range", async () => {
    const d = deps();
    const old = await book(d.orders, "2026-06-01T13:00:00Z", order(6000, [item(["standard"]), item(["standard"]), item(["standard"])]));
    old.items[1]!.status = "UNDER_REVIEW";
    old.items[2]!.status = "READY_FOR_PICKUP_SHIPPING";
    const paid = await book(d.orders, "2026-06-02T13:00:00Z", order(4000));
    await d.orders.transitionItemStatus({
      itemId: paid.items[0]!.id,
      toStatus: "UNDER_REVIEW",
      entry: { action: "MANUAL_PAYMENT_CONFIRMED", fromStatus: "REQUEST_SUBMITTED", toStatus: "UNDER_REVIEW", actorAccountId: "acc_admin", idempotencyKey: "k" },
    });

    const overview = await getAdminOverview(d, ADMIN, "this-week");

    expect(overview.orders.current).toBe(0);
    expect(overview.needsQuote).toBe(3); // old: submitted + under review; paid: under review
    expect(overview.readyForReturn).toBe(1);
    expect(overview.awaitingDeposit).toEqual({ orders: 1, deposits: Money.fromCents(3000) });
  });
});

describe("percentChange", () => {
  it("rounds to a whole percent and has no answer against zero", () => {
    expect(percentChange(12, 10)).toBe(20);
    expect(percentChange(5, 10)).toBe(-50);
    expect(percentChange(2, 3)).toBe(-33);
    expect(percentChange(4, 0)).toBeNull();
  });
});
