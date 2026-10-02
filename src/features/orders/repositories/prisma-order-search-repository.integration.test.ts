// Proves OrderSearchRepository against a REAL Postgres. Requires TEST_DATABASE_URL; run with `npm run test:integration`.

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Money } from "@/shared/money/money";
import { deleteAllOrders } from "@/shared/testing/delete-all-orders";
import type { ItemStatus } from "../domain";
import type { NewItemInput, NewOrderInput } from "./order-repository";
import type { OrderSearchFilters } from "./order-search-repository";
import { PrismaOrderRepository } from "./prisma-order-repository";
import { PrismaOrderSearchRepository } from "./prisma-order-search-repository";

const prisma = new PrismaClient();
const orders = new PrismaOrderRepository(prisma);
const search = new PrismaOrderSearchRepository(prisma);

beforeEach(async () => {
  await deleteAllOrders(prisma);
  await prisma.signInCode.deleteMany();
  await prisma.account.deleteMany({ where: { role: "CUSTOMER" } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

let counter = 0;
function pair(overrides: Partial<NewItemInput> = {}): NewItemInput {
  counter += 1;
  return {
    brand: null,
    model: null,
    description: null,
    material: null,
    serviceIds: ["standard"],
    estimate: Money.fromCents(3000),
    photos: [{ key: `photos/search-${counter}.jpg`, uploadKey: `bookings/search-${counter}.jpg` }],
    ...overrides,
  };
}

/** Books an Order for `name`, then sets its pairs' statuses and booking time directly. */
async function book(name: string, options: { email?: string; phone?: string; statuses?: ItemStatus[]; createdAt?: string; serviceIds?: string[] } = {}) {
  counter += 1;
  const statuses = options.statuses ?? ["REQUEST_SUBMITTED"];
  const input: NewOrderInput = {
    owner: { newCustomer: { email: options.email ?? `search${counter}@example.com`, phone: "2125550142" } },
    contactName: name,
    contactEmail: options.email ?? `search${counter}@example.com`,
    contactPhone: options.phone ?? "2125550142",
    policyAcceptedAt: new Date(),
    terms: { version: "v1", url: "/terms.pdf", sha256: "x", acknowledgments: {} },
    fulfillment: { method: "MAIL_IN", address: { line1: "1 Main St", line2: null, city: "Austin", state: "TX", zip: "73301" }, preferredDate: null },
    rush: false,
    estimate: Money.fromCents(3000 * statuses.length),
    estimateIsMinimum: false,
    deposit: Money.fromCents(1500),
    depositPayment: { method: "ZELLE", amount: Money.fromCents(1500) },
    collection: null,
    submissionKey: null,
    submissionFingerprint: null,
    bundleId: null,
    alertBody: "Alert",
    items: statuses.map(() => pair({ serviceIds: options.serviceIds ?? ["standard"] })),
  };
  const { order } = await orders.create(input);
  const items = await prisma.item.findMany({ where: { orderId: order.id }, orderBy: { position: "asc" } });
  await Promise.all(items.map((item, i) => prisma.item.update({ where: { id: item.id }, data: { status: statuses[i] } })));
  if (options.createdAt) await prisma.order.update({ where: { id: order.id }, data: { createdAt: new Date(options.createdAt) } });
  return order;
}

const filters = (overrides: Partial<OrderSearchFilters> = {}): OrderSearchFilters => ({ q: null, status: null, from: null, to: null, serviceId: null, limit: 10, offset: 0, ...overrides });
const names = async (overrides: Partial<OrderSearchFilters> = {}) => (await search.searchOrders(filters(overrides))).rows.map((row) => row.contactName);

describe("PrismaOrderSearchRepository (integration)", () => {
  it("lists newest booking first with the row's figures", async () => {
    await book("Older", { createdAt: "2026-09-28T14:00:00Z" });
    await book("Newer", { createdAt: "2026-09-30T14:00:00Z", statuses: ["IN_PROGRESS", "CANCELLED"] });

    const { rows, total } = await search.searchOrders(filters());
    expect(rows.map((row) => row.contactName)).toEqual(["Newer", "Older"]);
    expect(total).toBe(2);
    expect(rows[0]!.items.map((item) => item.status)).toEqual(["IN_PROGRESS", "CANCELLED"]);
    expect(rows[0]!.estimate.cents).toBe(6000);
    expect(rows[0]!.deposit).toEqual({ method: "ZELLE", status: "PENDING" });
  });

  it("matches the order number, name, email and phone, case-insensitively", async () => {
    const sam = await book("Sam Rivera", { email: "Sam.Rivera@Example.com", phone: "3475550111" });
    await book("Other Person");

    expect(await names({ q: `ATU-${sam.number}` })).toEqual(["Sam Rivera"]);
    expect(await names({ q: `atu-${sam.number}` })).toEqual(["Sam Rivera"]);
    expect(await names({ q: String(sam.number) })).toEqual(["Sam Rivera"]);
    expect(await names({ q: "RIVERA" })).toEqual(["Sam Rivera"]);
    expect(await names({ q: "sam.rivera@example" })).toEqual(["Sam Rivera"]);
    expect(await names({ q: "555011" })).toEqual(["Sam Rivera"]);
    expect(await names({ q: "nobody" })).toEqual([]);
  });

  it("matches a phone number however it's formatted, on either side", async () => {
    await book("Formatted", { phone: "(347) 555-0111" });
    await book("Bare", { phone: "9175550122" });
    for (const q of ["3475550111", "347-555-0111", "+1 (347) 555 0111", "555-0111"]) expect(await names({ q })).toEqual(["Formatted"]);
    expect(await names({ q: "(917) 555-0122" })).toEqual(["Bare"]);
  });

  it("treats SQL and wildcard characters in the text as plain text", async () => {
    await book("Sam Rivera");
    expect(await names({ q: "'; DROP TABLE orders; --" })).toEqual([]);
    expect(await names({ q: "%" })).toEqual([]);
    expect(await prisma.order.count()).toBe(1);
  });

  it("still finds text that really contains an underscore or percent sign", async () => {
    await book("Sam Rivera", { email: "sam_rivera@example.com" });
    await book("Samxrivera", { email: "samxrivera@example.com" });
    await book("100% Kicks");
    expect(await names({ q: "sam_rivera" })).toEqual(["Sam Rivera"]);
    expect(await names({ q: "100%" })).toEqual(["100% Kicks"]);
  });

  it("filters by the derived Order status", async () => {
    await book("Mixed", { createdAt: "2026-09-28T14:00:00Z", statuses: ["IN_PROGRESS", "APPROVED"] });
    await book("Done", { createdAt: "2026-09-29T14:00:00Z", statuses: ["COMPLETED"] });
    await book("Gone", { createdAt: "2026-09-30T14:00:00Z", statuses: ["CANCELLED", "CANCELLED"] });
    await book("Rest", { createdAt: "2026-10-01T14:00:00Z", statuses: ["CANCELLED", "COMPLETED"] }); // live pairs: only Completed

    expect(await names({ status: "APPROVED" })).toEqual(["Mixed"]);
    expect(await names({ status: "IN_PROGRESS" })).toEqual([]);
    expect(await names({ status: "COMPLETED" })).toEqual(["Rest", "Done"]);
    expect(await names({ status: "CANCELLED" })).toEqual(["Gone"]);
  });

  it("filters by booking time [from, to) and by Service, and combines filters", async () => {
    await book("Early", { createdAt: "2026-09-28T14:00:00Z", serviceIds: ["premium"] });
    await book("Middle", { createdAt: "2026-09-29T14:00:00Z" });
    await book("Late", { createdAt: "2026-09-30T14:00:00Z", serviceIds: ["premium"] });

    expect(await names({ from: new Date("2026-09-29T00:00:00Z"), to: new Date("2026-09-30T14:00:00Z") })).toEqual(["Middle"]);
    expect(await names({ serviceId: "premium" })).toEqual(["Late", "Early"]);
    expect(await names({ serviceId: "premium", from: new Date("2026-09-30T00:00:00Z") })).toEqual(["Late"]);
    expect(await names({ serviceId: "premium", q: "mid" })).toEqual([]);
  });

  it("pages, with the total of every match", async () => {
    for (let day = 10; day < 15; day++) await book(`Order ${day}`, { createdAt: `2026-09-${day}T14:00:00Z` });

    const first = await search.searchOrders(filters({ limit: 2 }));
    expect(first.rows.map((row) => row.contactName)).toEqual(["Order 14", "Order 13"]);
    expect(first.total).toBe(5);
    expect((await search.searchOrders(filters({ limit: 2, offset: 4 }))).rows.map((row) => row.contactName)).toEqual(["Order 10"]);
  });
});
