import { describe, expect, it } from "vitest";
import { UnauthorizedError, type ActingUser } from "@/features/accounts/authz";
import { collectionTimes } from "@/features/orders/pickup-window";
import { InMemoryOrderRepository } from "@/features/orders/repositories/in-memory-order-repository";
import type { NewItemInput, NewOrderInput } from "@/features/orders/repositories/order-repository";
import { Money } from "@/shared/money/money";
import { getScheduledVisit } from "./scheduled-visit";

const ADMIN: ActingUser = { accountId: "acc_admin", role: "ADMIN" };

let counter = 0;
function pair(overrides: Partial<NewItemInput> = {}): NewItemInput {
  counter += 1;
  return {
    brand: "Nike",
    model: "Air Max 90",
    description: null,
    material: null,
    serviceIds: ["premium"],
    estimate: Money.fromCents(4000),
    photos: [{ key: `photos/${counter}.jpg`, uploadKey: `bookings/${counter}.jpg` }],
    ...overrides,
  };
}

function booking(items: NewItemInput[] = [pair()]): NewOrderInput {
  counter += 1;
  return {
    owner: { newCustomer: { email: `c${counter}@example.com`, phone: "2125550142" } },
    contactName: "Sarah Kim",
    contactEmail: "sarah@example.com",
    contactPhone: "(212) 555-0142",
    policyAcceptedAt: new Date(),
    terms: { version: "v1", url: "/terms.pdf", sha256: "x", acknowledgments: {} },
    fulfillment: {
      method: "PICKUP",
      address: { line1: "1 Main St", line2: "Apt 4B", city: "Brooklyn", state: "NY", zip: "11201" },
      date: "2026-09-26",
      slot: "6:00 PM – 6:30 PM",
    },
    rush: false,
    estimate: Money.fromCents(items.length * 4000),
    estimateIsMinimum: false,
    deposit: Money.fromCents(2000),
    depositPayment: null,
    collection: collectionTimes("2026-09-26", "6:00 PM – 6:30 PM"),
    submissionKey: null,
    submissionFingerprint: null,
    bundleId: null,
    alertBody: "Jordan · Standard Clean · Mail-In",
    items,
  };
}

function setup() {
  const orders = new InMemoryOrderRepository();
  return { orders, photoUrl: async (key: string) => `https://photos.test/${key}` };
}

describe("getScheduledVisit", () => {
  it("is admin-only", async () => {
    const d = setup();
    const { order } = await d.orders.create(booking());
    const id = order.appointments[0]!.id;
    await expect(getScheduledVisit(d, { accountId: "acc_c", role: "CUSTOMER" }, id)).rejects.toThrow(UnauthorizedError);
    await expect(getScheduledVisit(d, { accountId: null, role: "GUEST" }, id)).rejects.toThrow(UnauthorizedError);
  });

  it("is null when no Appointment has the id", async () => {
    expect(await getScheduledVisit(setup(), ADMIN, "missing")).toBeNull();
  });

  it("describes the visit, the customer and the order in shop time", async () => {
    const d = setup();
    const { order } = await d.orders.create(booking());
    order.appointments[0]!.notes = "  Call on arrival  ";

    const visit = await getScheduledVisit(d, ADMIN, order.appointments[0]!.id);

    expect(visit).toMatchObject({
      appointmentId: order.appointments[0]!.id,
      kind: "COLLECTION",
      status: "SCHEDULED",
      window: "6:00 PM – 6:30 PM",
      date: "Sat, Sep 26, 2026",
      notes: "Call on arrival",
      customer: { name: "Sarah Kim", phone: "(212) 555-0142", email: "sarah@example.com", address: "1 Main St, Apt 4B, Brooklyn, NY 11201" },
      order: { id: order.id, reference: `ATU-${order.number}`, firstPair: "Nike Air Max 90", pairCount: 1, services: "Premium Clean", estimateIsMinimum: false },
    });
    expect(visit!.order.photo).toEqual({ kind: "stored", url: expect.stringMatching(/^https:\/\/photos\.test\/photos\//) });
    expect(visit!.order.estimate.cents).toBe(4000);
  });

  it("counts only live pairs and has no notes or photo when there are none", async () => {
    const d = setup();
    const { order } = await d.orders.create(booking([pair({ photos: [] }), pair()]));
    order.items[0]!.status = "CANCELLED";

    const visit = await getScheduledVisit(d, ADMIN, order.appointments[0]!.id);

    expect(visit!.order.pairCount).toBe(1);
    expect(visit!.order.estimate.cents).toBe(4000);
    expect(visit!.notes).toBeNull();
  });

  it("still loads a completed or cancelled visit, with its status", async () => {
    const d = setup();
    const { order } = await d.orders.create(booking());
    order.appointments[0]!.status = "CANCELLED";
    expect((await getScheduledVisit(d, ADMIN, order.appointments[0]!.id))!.status).toBe("CANCELLED");
  });
});
