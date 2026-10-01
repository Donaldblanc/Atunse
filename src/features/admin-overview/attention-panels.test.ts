import { describe, expect, it } from "vitest";
import { UnauthorizedError, type ActingUser } from "@/features/accounts/authz";
import { InMemoryOrderRepository } from "@/features/orders/repositories/in-memory-order-repository";
import type { NewItemInput, NewOrderInput } from "@/features/orders/repositories/order-repository";
import { Money } from "@/shared/money/money";
import { getNeedsQuote, getPendingPayments, getReadyToReturn, parseAttentionPanel } from "./attention-panels";

const ADMIN: ActingUser = { accountId: "acc_admin", role: "ADMIN" };

let counter = 0;
function pair(overrides: Partial<NewItemInput> = {}): NewItemInput {
  counter += 1;
  return {
    brand: "Nike",
    model: "Air Max 90",
    description: null,
    material: null,
    serviceIds: ["standard"],
    estimate: Money.fromCents(3000),
    photos: [{ key: `photos/${counter}.jpg`, uploadKey: `bookings/${counter}.jpg` }],
    ...overrides,
  };
}

function order(overrides: Partial<NewOrderInput> = {}): NewOrderInput {
  counter += 1;
  return {
    owner: { newCustomer: { email: `c${counter}@example.com`, phone: "2125550142" } },
    contactName: "Jordan Smith",
    contactEmail: `c${counter}@example.com`,
    contactPhone: "2125550142",
    policyAcceptedAt: new Date(),
    terms: { version: "v1", url: "/terms.pdf", sha256: "x", acknowledgments: {} },
    fulfillment: { method: "MAIL_IN", address: { line1: "1 Main St", line2: null, city: "Austin", state: "TX", zip: "73301" }, preferredDate: null },
    rush: false,
    estimate: Money.fromCents(3000),
    estimateIsMinimum: false,
    deposit: Money.fromCents(1500),
    depositPayment: { method: "ZELLE", amount: Money.fromCents(1500) },
    collection: null,
    submissionKey: null,
    submissionFingerprint: null,
    bundleId: null,
    items: [pair()],
    ...overrides,
  };
}

/** Books an Order as if submitted at `createdAt`. */
async function book(orders: InMemoryOrderRepository, createdAt: string, input: NewOrderInput = order()) {
  const { order: booked } = await orders.create(input);
  booked.createdAt = new Date(createdAt);
  return booked;
}

describe("parseAttentionPanel", () => {
  it("accepts the three panels and nothing else", () => {
    expect(parseAttentionPanel("pending-payments")).toBe("pending-payments");
    expect(parseAttentionPanel("needs-quote")).toBe("needs-quote");
    expect(parseAttentionPanel("nope")).toBeNull();
    expect(parseAttentionPanel(["needs-quote"])).toBeNull();
    expect(parseAttentionPanel(undefined)).toBeNull();
  });
});

describe("getPendingPayments", () => {
  it("lists the PENDING Deposits oldest first, and agrees with the Overview's count", async () => {
    const orders = new InMemoryOrderRepository();
    const cash = await book(orders, "2026-09-29T14:00:00Z", order({ contactName: "Sam Cash", deposit: Money.fromCents(12000), depositPayment: { method: "CASH", amount: Money.fromCents(12000) } }));
    const zelle = await book(orders, "2026-09-28T14:00:00Z", order({ contactName: "Zoe Zelle" }));
    const paid = await book(orders, "2026-09-27T14:00:00Z");
    paid.payments[0]!.status = "RECEIVED";
    const cancelled = await book(orders, "2026-09-26T14:00:00Z");
    cancelled.items[0]!.status = "CANCELLED";

    const rows = await getPendingPayments({ orders }, ADMIN);

    expect(rows).toEqual([
      { orderId: zelle.id, reference: `ATU-${zelle.number}`, customerName: "Zoe Zelle", method: "ZELLE", methodLabel: "Zelle", amount: "$15", bookedOn: "Sep 28, 2026" },
      { orderId: cash.id, reference: `ATU-${cash.number}`, customerName: "Sam Cash", method: "CASH", methodLabel: "Cash", amount: "$120", bookedOn: "Sep 29, 2026" },
    ]);
    expect(rows.length).toBe((await orders.summarizeAwaitingDeposit()).orders);
  });

  it("is admin-only", async () => {
    await expect(getPendingPayments({ orders: new InMemoryOrderRepository() }, { accountId: null, role: "GUEST" })).rejects.toThrow(UnauthorizedError);
  });
});

describe("getReadyToReturn", () => {
  it("lists Orders with pairs ready to go back, with how many and how they return", async () => {
    const orders = new InMemoryOrderRepository();
    const ready = await book(orders, "2026-09-28T14:00:00Z", order({ items: [pair(), pair(), pair()] }));
    ready.items[0]!.status = "READY_FOR_PICKUP_SHIPPING";
    ready.items[1]!.status = "READY_FOR_PICKUP_SHIPPING";
    await book(orders, "2026-09-27T14:00:00Z"); // still REQUEST_SUBMITTED

    const rows = await getReadyToReturn({ orders }, ADMIN);

    expect(rows).toEqual([
      { orderId: ready.id, reference: `ATU-${ready.number}`, customerName: "Jordan Smith", pairsReady: 2, fulfillment: "Mail-In", bookedOn: "Sep 28, 2026", returnVisit: { kind: "none" } },
    ]);
  });

  it("offers a return visit for Local Drop-Off, and shows it once booked", async () => {
    const orders = new InMemoryOrderRepository();
    const local = await book(
      orders,
      "2026-09-28T14:00:00Z",
      order({ fulfillment: { method: "PICKUP", address: { line1: "1 A St", line2: null, city: "New York", state: "NY", zip: "10001" }, date: "2026-10-03", slot: "4:30 PM – 5:00 PM" } }),
    );
    local.items[0]!.status = "READY_FOR_PICKUP_SHIPPING";

    expect((await getReadyToReturn({ orders }, ADMIN))[0]!.returnVisit).toEqual({ kind: "bookable" });

    const { appointment } = await orders.bookReturnAppointment({ orderId: local.id, startsAt: new Date("2026-10-08T14:00:00Z"), endsAt: new Date("2026-10-08T14:30:00Z") });
    expect((await getReadyToReturn({ orders }, ADMIN))[0]!.returnVisit).toEqual({ kind: "booked", appointmentId: appointment.id, when: "Thu, Oct 8, 10:00 AM" });
  });
});

describe("getNeedsQuote", () => {
  it("lists each pair awaiting review or a quote, matching the status count", async () => {
    const orders = new InMemoryOrderRepository();
    const booked = await book(orders, "2026-09-28T14:00:00Z", order({ items: [pair(), pair({ brand: null, model: null, serviceIds: ["standard", "premium"] }), pair()] }));
    booked.items[0]!.status = "UNDER_REVIEW";
    booked.items[2]!.status = "QUOTE_SENT"; // already quoted: not listed

    const rows = await getNeedsQuote({ orders }, ADMIN);

    expect(rows.map((row) => [row.itemId, row.pair])).toEqual([
      [booked.items[0]!.id, "Nike Air Max 90"],
      [booked.items[1]!.id, "Sneakers"],
    ]);
    expect(rows[0]).toMatchObject({ orderId: booked.id, reference: `ATU-${booked.number}`, customerName: "Jordan Smith", bookedOn: "Sep 28, 2026" });
    const counts = await orders.countItemsByStatus();
    expect(rows.length).toBe((counts.REQUEST_SUBMITTED ?? 0) + (counts.UNDER_REVIEW ?? 0));
  });
});
