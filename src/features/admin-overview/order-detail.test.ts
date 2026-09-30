import { describe, expect, it } from "vitest";
import { UnauthorizedError, type ActingUser } from "@/features/accounts/authz";
import { InMemoryOrderRepository } from "@/features/orders/repositories/in-memory-order-repository";
import type { NewItemInput, NewOrderInput, StatusChange } from "@/features/orders/repositories/order-repository";
import { Money } from "@/shared/money/money";
import { buildTimeline, getOrderDetail } from "./order-detail";

const ADMIN: ActingUser = { accountId: "acc_admin", role: "ADMIN" };

let counter = 0;
function item(overrides: Partial<NewItemInput> = {}): NewItemInput {
  counter += 1;
  return {
    brand: "Nike",
    model: "Air Max 90",
    description: "Yellowed midsole",
    material: "Leather",
    serviceIds: ["premium", "laces"],
    estimate: Money.fromCents(6500),
    photos: [{ key: `photos/${counter}.jpg`, uploadKey: `bookings/${counter}.jpg` }],
    ...overrides,
  };
}

function newOrder(overrides: Partial<NewOrderInput> = {}): NewOrderInput {
  counter += 1;
  return {
    owner: {
      newCustomer: { email: `c${counter}@example.com`, phone: "2125550142" },
    },
    contactName: "Jordan Smith",
    contactEmail: "jordan@example.com",
    contactPhone: "(212) 555-0142",
    policyAcceptedAt: new Date(),
    terms: {
      version: "v1",
      url: "/terms.pdf",
      sha256: "x",
      acknowledgments: {},
    },
    fulfillment: {
      method: "PICKUP",
      address: {
        line1: "12 Elm St",
        line2: "Apt 4",
        city: "Brooklyn",
        state: "NY",
        zip: "11201",
      },
      date: "2026-10-03",
      slot: "4:30 PM – 5:00 PM",
    },
    rush: true,
    estimate: Money.fromCents(8500),
    estimateIsMinimum: false,
    deposit: Money.fromCents(4250),
    depositPayment: { method: "ZELLE", amount: Money.fromCents(4250) },
    collection: null,
    submissionKey: null,
    submissionFingerprint: null,
    bundleId: null,
    items: [item()],
    ...overrides,
  };
}

function setup() {
  const orders = new InMemoryOrderRepository();
  return {
    orders,
    photoUrl: async (key: string) => `https://photos.test/${key}`,
  };
}

describe("getOrderDetail", () => {
  it("rejects a non-admin caller", async () => {
    const deps = setup();
    const { order } = await deps.orders.create(newOrder());
    await expect(getOrderDetail(deps, { accountId: "acc_1", role: "CUSTOMER" }, order.id)).rejects.toThrow(UnauthorizedError);
  });

  it("is null for an unknown id", async () => {
    expect(await getOrderDetail(setup(), ADMIN, "nope")).toBeNull();
  });

  it("gathers the customer, pair, payment and totals", async () => {
    const deps = setup();
    const { order } = await deps.orders.create(newOrder());

    const detail = (await getOrderDetail(deps, ADMIN, order.id))!;

    expect(detail).toMatchObject({
      orderId: order.id,
      reference: `ATU-${order.number}`,
      status: "REQUEST_SUBMITTED",
      bundleName: null,
      customer: {
        name: "Jordan Smith",
        email: "jordan@example.com",
        phone: "(212) 555-0142",
        fulfillment: "Local Drop-Off",
        schedule: { date: "2026-10-03", slot: "4:30 PM – 5:00 PM" },
        address: ["12 Elm St", "Apt 4", "Brooklyn, NY 11201"],
      },
      payment: {
        deposit: { method: "ZELLE", status: "PENDING" },
        estimateIsMinimum: false,
      },
    });
    expect(detail.payment.estimate.format()).toBe("$85");
    expect(detail.payment.depositDue.format()).toBe("$42.50");
    expect(detail.payment.rush?.format()).toBe("$20");
    expect(detail.pairs).toEqual([
      expect.objectContaining({
        title: "Nike Air Max 90",
        details: ["Leather", "Yellowed midsole"],
        photo: { kind: "stored", url: expect.stringMatching(/^https:\/\/photos\.test\/photos\//) },
        services: [
          { name: "Premium Clean", price: "$50" },
          { name: "Lace Replacement", price: "$15" },
        ],
        nextStatuses: ["UNDER_REVIEW", "CANCELLED"],
      }),
    ]);
  });

  it("shows the quote per pair and a quoted total once any pair is quoted", async () => {
    const deps = setup();
    const { order } = await deps.orders.create(newOrder({ rush: false, bundleId: "revival", items: [item(), item(), item()] }));
    expect((await getOrderDetail(deps, ADMIN, order.id))!.payment.quoted).toBeNull();

    deps.orders.orders.get(order.id)!.items[0]!.price = Money.fromCents(7000);
    let detail = (await getOrderDetail(deps, ADMIN, order.id))!;
    expect(detail.pairs.map((pair) => pair.price?.cents ?? null)).toEqual([7000, null, null]);
    expect(detail.payment.quoted).toMatchObject({ complete: false, pairs: 1, of: 3 });
    expect(detail.payment.quoted!.total.cents).toBe(7000);

    for (const pair of deps.orders.orders.get(order.id)!.items) pair.price = Money.fromCents(7000);
    deps.orders.orders.get(order.id)!.items[2]!.status = "CANCELLED";
    detail = (await getOrderDetail(deps, ADMIN, order.id))!;
    expect(detail.payment.quoted).toMatchObject({ complete: true, pairs: 2, of: 2 });
    expect(detail.payment.quoted!.total.cents).toBe(14000);
  });

  it("offers Cancel only at Under Review and Quote Sent: the quote and approval have their own controls", async () => {
    const deps = setup();
    const { order } = await deps.orders.create(newOrder());
    for (const status of ["UNDER_REVIEW", "QUOTE_SENT"] as const) {
      deps.orders.orders.get(order.id)!.items[0]!.status = status;
      expect((await getOrderDetail(deps, ADMIN, order.id))!.pairs[0]!.nextStatuses).toEqual(["CANCELLED"]);
    }
  });

  it("names Mail-In and leaves a Bundle's Service prices off", async () => {
    const deps = setup();
    const { order } = await deps.orders.create(
      newOrder({
        bundleId: "revival",
        fulfillment: {
          method: "MAIL_IN",
          address: {
            line1: "1 Main St",
            line2: null,
            city: "Austin",
            state: "TX",
            zip: "73301",
          },
          preferredDate: null,
        },
        items: [item(), item(), item()],
      }),
    );

    const detail = (await getOrderDetail(deps, ADMIN, order.id))!;

    expect(detail.customer).toMatchObject({
      fulfillment: "Mail-In",
      schedule: null,
      address: ["1 Main St", "Austin, TX 73301"],
    });
    expect(detail.bundleName).toBe("The Revival Pack");
    expect(detail.pairs.flatMap((pair) => pair.services.map((service) => service.price))).toEqual([null, null, null, null, null, null]);
  });

  it("shows the Order's notes, oldest first", async () => {
    const deps = setup();
    const { order } = await deps.orders.create(newOrder());
    deps.orders.notes.push(
      {
        id: "n2",
        orderId: order.id,
        body: "Second",
        createdAt: new Date("2026-10-02T12:00:00Z"),
      },
      {
        id: "n1",
        orderId: order.id,
        body: "First",
        createdAt: new Date("2026-10-01T12:00:00Z"),
      },
      {
        id: "n3",
        orderId: "other",
        body: "Elsewhere",
        createdAt: new Date("2026-10-01T12:00:00Z"),
      },
    );

    expect((await getOrderDetail(deps, ADMIN, order.id))!.notes.map((note) => note.body)).toEqual(["First", "Second"]);
  });

  it("doesn't read a confirmed deposit as a status change", async () => {
    const deps = setup();
    const { order } = await deps.orders.create(newOrder());
    await deps.orders.confirmDeposit({ orderId: order.id, actorAccountId: "acc_admin", idempotencyKey: "k1" });

    expect(await deps.orders.listStatusChanges(order.id)).toEqual([]);
  });

  it("times the timeline from the audit log", async () => {
    const deps = setup();
    const { order } = await deps.orders.create(newOrder());
    await deps.orders.transitionItemStatus({
      itemId: order.items[0]!.id,
      toStatus: "UNDER_REVIEW",
      entry: {
        action: "STATUS_TRANSITION",
        fromStatus: "REQUEST_SUBMITTED",
        toStatus: "UNDER_REVIEW",
        actorAccountId: "acc_admin",
        idempotencyKey: null,
      },
    });

    const { timeline } = (await getOrderDetail(deps, ADMIN, order.id))!;

    expect(timeline.map((step) => [step.status, step.state])).toEqual([
      ["REQUEST_SUBMITTED", "done"],
      ["UNDER_REVIEW", "current"],
      ["QUOTE_SENT", "upcoming"],
      ["APPROVED", "upcoming"],
      ["AWAITING_SNEAKERS", "upcoming"],
      ["IN_PROGRESS", "upcoming"],
      ["QUALITY_CHECK", "upcoming"],
      ["READY_FOR_PICKUP_SHIPPING", "upcoming"],
      ["COMPLETED", "upcoming"],
    ]);
    expect(timeline[0]!.at).toEqual(order.createdAt);
    expect(timeline[1]!.at).toBeInstanceOf(Date);
    expect(timeline[2]!.at).toBeNull();
  });

  it("offers no next status for a finished pair", async () => {
    const deps = setup();
    const { order } = await deps.orders.create(newOrder());
    order.items[0]!.status = "COMPLETED";
    expect((await getOrderDetail(deps, ADMIN, order.id))!.pairs[0]!.nextStatuses).toEqual([]);
  });
});

describe("buildTimeline", () => {
  const at = (iso: string) => new Date(iso);
  const booked = at("2026-10-01T10:00:00Z");
  const changes: StatusChange[] = [
    { itemId: "a", toStatus: "UNDER_REVIEW", at: at("2026-10-01T11:00:00Z") },
    { itemId: "b", toStatus: "UNDER_REVIEW", at: at("2026-10-01T12:00:00Z") },
    { itemId: "a", toStatus: "QUOTE_SENT", at: at("2026-10-01T13:00:00Z") },
  ];

  it("times a step when its last pair reached it, and leaves it untimed until they all have", () => {
    const timeline = buildTimeline("UNDER_REVIEW", [{ id: "a" }, { id: "b" }], changes, booked);
    expect(timeline.find((step) => step.status === "UNDER_REVIEW")).toMatchObject({ state: "current", at: at("2026-10-01T12:00:00Z") });
    expect(timeline.find((step) => step.status === "QUOTE_SENT")!.at).toBeNull();
  });

  it("doesn't invent a time when the log has none", () => {
    const timeline = buildTimeline("QUOTE_SENT", [{ id: "c" }], [], booked);
    expect(timeline.filter((step) => step.state === "done").map((step) => [step.status, step.at])).toEqual([
      ["REQUEST_SUBMITTED", booked],
      ["UNDER_REVIEW", null],
    ]);
  });

  it("marks every step done once Completed", () => {
    expect(buildTimeline("COMPLETED", [{ id: "a" }], [], booked).map((step) => step.state)).toEqual(Array(9).fill("done"));
  });

  it("stops at the steps a cancelled Order reached, then Cancelled", () => {
    const cancelled: StatusChange[] = [...changes.slice(0, 1), { itemId: "a", toStatus: "CANCELLED", at: at("2026-10-01T14:00:00Z") }];
    expect(buildTimeline("CANCELLED", [{ id: "a" }], cancelled, booked).map((step) => [step.status, step.state, step.at])).toEqual([
      ["REQUEST_SUBMITTED", "done", booked],
      ["UNDER_REVIEW", "done", at("2026-10-01T11:00:00Z")],
      ["CANCELLED", "current", at("2026-10-01T14:00:00Z")],
    ]);
  });
});
