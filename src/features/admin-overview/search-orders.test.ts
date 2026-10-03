import { describe, expect, it } from "vitest";
import { UnauthorizedError, type ActingUser } from "@/features/accounts/authz";
import { InMemoryOrderRepository } from "@/features/orders/repositories/in-memory-order-repository";
import { InMemoryOrderSearchRepository } from "@/features/orders/repositories/in-memory-order-search-repository";
import type { NewItemInput, NewOrderInput } from "@/features/orders/repositories/order-repository";
import { Money } from "@/shared/money/money";
import { ORDERS_PAGE_SIZE, parseOrdersQuery, searchOrders } from "./search-orders";

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
    owner: {
      newCustomer: { email: `c${counter}@example.com`, phone: "2125550142" },
    },
    contactName: "Jordan Smith",
    contactEmail: `c${counter}@example.com`,
    contactPhone: "2125550142",
    policyAcceptedAt: new Date(),
    terms: {
      version: "v1",
      url: "/terms.pdf",
      sha256: "x",
      acknowledgments: {},
    },
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
    rush: false,
    estimate: Money.fromCents(3000),
    estimateIsMinimum: false,
    deposit: Money.fromCents(1500),
    depositPayment: { method: "ZELLE", amount: Money.fromCents(1500) },
    collection: null,
    submissionKey: null,
    submissionFingerprint: null,
    bundleId: null,
    alertBody: "Jordan · Standard Clean · Mail-In",
    items: [pair()],
    ...overrides,
  };
}

async function setup() {
  const orders = new InMemoryOrderRepository();
  const book = async (createdAt: string, input: NewOrderInput = order()) => {
    const { order: booked } = await orders.create(input);
    booked.createdAt = new Date(createdAt);
    return booked;
  };
  return {
    orders,
    book,
    deps: { orderSearch: new InMemoryOrderSearchRepository(orders) },
  };
}

const query = (
  overrides: Partial<{
    q: string;
    status: Parameters<typeof searchOrders>[2]["status"];
    page: number;
    day: string | null;
    serviceId: string | null;
  }> = {},
) => ({
  q: "",
  status: null,
  page: 1,
  day: null,
  serviceId: null,
  ...overrides,
});

describe("parseOrdersQuery", () => {
  it("reads good params", () => {
    expect(parseOrdersQuery({ q: " sam ", status: "APPROVED", page: "3" })).toEqual({
      q: "sam",
      status: "APPROVED",
      page: 3,
      day: null,
      serviceId: null,
    });
  });
  it("falls back to the defaults for bad ones, each on its own", () => {
    expect(parseOrdersQuery({ q: "x".repeat(101), status: "BOGUS", page: "0" })).toEqual({ q: "", status: null, page: 1, day: null, serviceId: null });
    expect(parseOrdersQuery({ q: ["a", "b"], status: ["APPROVED"], page: "2.5" })).toEqual({ q: "", status: null, page: 1, day: null, serviceId: null });
    expect(parseOrdersQuery({ page: "-4", status: "CANCELLED" })).toEqual({
      q: "",
      status: "CANCELLED",
      page: 1,
      day: null,
      serviceId: null,
    });
    expect(parseOrdersQuery({})).toEqual({
      q: "",
      status: null,
      page: 1,
      day: null,
      serviceId: null,
    });
  });
});

describe("parseOrdersQuery day and service", () => {
  it("keeps a real day and a catalog Service, with the other params", () => {
    expect(
      parseOrdersQuery({
        day: "2026-09-30",
        service: "premium",
        q: "sam",
        status: "APPROVED",
        page: "2",
      }),
    ).toEqual({
      q: "sam",
      status: "APPROVED",
      page: 2,
      day: "2026-09-30",
      serviceId: "premium",
    });
  });

  it("ignores a malformed or impossible day and an unknown Service", () => {
    for (const day of ["2026-9-30", "2026-02-30", "tomorrow", "2026-09-30T00:00"]) expect(parseOrdersQuery({ day }).day).toBeNull();
    expect(parseOrdersQuery({ day: ["2026-09-30"] }).day).toBeNull();
    expect(parseOrdersQuery({ service: "nope" }).serviceId).toBeNull();
    expect(parseOrdersQuery({ service: ["premium"] }).serviceId).toBeNull();
  });
});

describe("searchOrders", () => {
  it("is admin-only", async () => {
    const { deps } = await setup();
    await expect(searchOrders(deps, { accountId: null, role: "GUEST" }, query())).rejects.toThrow(UnauthorizedError);
    await expect(searchOrders(deps, { accountId: "acc_c", role: "CUSTOMER" }, query())).rejects.toThrow(UnauthorizedError);
  });

  it("lists the newest booking first, with the derived status and the live total", async () => {
    const { book, deps } = await setup();
    await book("2026-09-28T14:00:00Z", order({ contactName: "Older" }));
    const newer = await book(
      "2026-09-30T14:00:00Z",
      order({
        contactName: "Newer",
        estimate: Money.fromCents(6000),
        items: [pair(), pair()],
      }),
    );
    newer.items[0]!.status = "CANCELLED";
    newer.items[1]!.status = "IN_PROGRESS";

    const list = await searchOrders(deps, ADMIN, query());
    expect(list.rows.map((row) => row.customerName)).toEqual(["Newer", "Older"]);
    expect(list.rows[0]).toMatchObject({
      status: "IN_PROGRESS",
      pairCount: 1,
      deposit: { method: "ZELLE", status: "PENDING" },
    });
    expect(list.rows[0]!.total.cents).toBe(3000);
    expect(list.total).toBe(2);
  });

  it("finds by order number (ATU-1001 or 1001), name, email and phone, case-insensitively", async () => {
    const { book, deps } = await setup();
    const sam = await book(
      "2026-09-28T14:00:00Z",
      order({
        contactName: "Sam Rivera",
        contactEmail: "Sam@Example.com",
        contactPhone: "3475550111",
      }),
    );
    await book("2026-09-29T14:00:00Z", order({ contactName: "Other Person" }));
    const names = async (q: string) => (await searchOrders(deps, ADMIN, query({ q }))).rows.map((row) => row.customerName);

    expect(await names(`ATU-${sam.number}`)).toEqual(["Sam Rivera"]);
    expect(await names(`atu-${sam.number}`)).toEqual(["Sam Rivera"]);
    expect(await names(String(sam.number))).toEqual(["Sam Rivera"]);
    expect(await names("rivera")).toEqual(["Sam Rivera"]);
    expect(await names("SAM@example")).toEqual(["Sam Rivera"]);
    expect(await names("555011")).toEqual(["Sam Rivera"]);
    expect(await names("nobody")).toEqual([]);
  });

  it("filters by the derived Order status", async () => {
    const { book, deps } = await setup();
    const mixed = await book("2026-09-28T14:00:00Z", order({ contactName: "Mixed", items: [pair(), pair()] }));
    mixed.items[0]!.status = "IN_PROGRESS";
    mixed.items[1]!.status = "APPROVED"; // the least advanced live pair rules
    const done = await book("2026-09-29T14:00:00Z", order({ contactName: "Done" }));
    done.items[0]!.status = "COMPLETED";
    const gone = await book("2026-09-30T14:00:00Z", order({ contactName: "Gone" }));
    gone.items[0]!.status = "CANCELLED";
    const names = async (status: "APPROVED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED") =>
      (await searchOrders(deps, ADMIN, query({ status }))).rows.map((row) => row.customerName);

    expect(await names("APPROVED")).toEqual(["Mixed"]);
    expect(await names("IN_PROGRESS")).toEqual([]);
    expect(await names("COMPLETED")).toEqual(["Done"]);
    expect(await names("CANCELLED")).toEqual(["Gone"]);
  });

  it("pages, and shows the last page for one past the end", async () => {
    const { book, deps } = await setup();
    for (let day = 0; day < ORDERS_PAGE_SIZE + 3; day++) await book(`2026-09-${String(10 + day).padStart(2, "0")}T14:00:00Z`);

    const first = await searchOrders(deps, ADMIN, query());
    expect(first).toMatchObject({
      page: 1,
      pageCount: 2,
      total: ORDERS_PAGE_SIZE + 3,
    });
    expect(first.rows).toHaveLength(ORDERS_PAGE_SIZE);
    const second = await searchOrders(deps, ADMIN, query({ page: 2 }));
    expect(second.rows).toHaveLength(3);
    const past = await searchOrders(deps, ADMIN, query({ page: 99 }));
    expect(past).toMatchObject({ page: 2 });
    expect(past.rows).toHaveLength(3);
  });

  it("refuses text over 100 characters", async () => {
    const { deps } = await setup();
    await expect(searchOrders(deps, ADMIN, query({ q: "x".repeat(101) }))).rejects.toThrow();
  });

  it("filters to the New York day booked, and to a Service within the range", async () => {
    const { book, deps } = await setup();
    // 02:00 UTC on Oct 1 is still Sep 30 in New York.
    await book(
      "2026-10-01T02:00:00Z",
      order({
        contactName: "Late Night",
        items: [pair({ serviceIds: ["premium"] })],
      }),
    );
    await book("2026-10-01T05:00:00Z", order({ contactName: "Next Day" }));
    await book(
      "2026-09-20T15:00:00Z",
      order({
        contactName: "Old Premium",
        items: [pair({ serviceIds: ["premium"] })],
      }),
    );

    const day = await searchOrders(deps, ADMIN, query({ day: "2026-09-30" }));
    expect(day.rows.map((row) => row.customerName)).toEqual(["Late Night"]);

    const range = {
      start: new Date("2026-09-28T04:00:00Z"),
      end: new Date("2026-10-05T04:00:00Z"),
    };
    const service = await searchOrders(deps, ADMIN, query({ serviceId: "premium" }), range);
    expect(service.rows.map((row) => row.customerName)).toEqual(["Late Night"]);
    const everywhere = await searchOrders(deps, ADMIN, query({ serviceId: "premium" }));
    expect(everywhere.total).toBe(2);
  });
});
