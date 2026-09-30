import { describe, expect, it } from "vitest";
import { UnauthorizedError, type ActingUser } from "@/features/accounts/authz";
import { Money } from "@/shared/money/money";
import { InMemoryOrderRepository } from "../repositories/in-memory-order-repository";
import { ItemNotFoundError, OrderChangedError, OrderNotFoundError, type NewOrderInput } from "../repositories/order-repository";
import { addOrderNote } from "./add-order-note";
import { cleanOrderDetails, updateOrderDetails, type RawOrderDetails } from "./update-order-details";

const ADMIN: ActingUser = { accountId: "acc_admin", role: "ADMIN" };
const CUSTOMER: ActingUser = { accountId: "acc_1", role: "CUSTOMER" };

let counter = 0;
async function bookOrder(pairs = 1) {
  counter += 1;
  const orders = new InMemoryOrderRepository();
  const input: NewOrderInput = {
    owner: { newCustomer: { email: `c${counter}@example.com`, phone: "2125550142" } },
    contactName: "Jordan Smith",
    contactEmail: `c${counter}@example.com`,
    contactPhone: "2125550142",
    policyAcceptedAt: new Date(),
    terms: { version: "v1", url: "/terms.pdf", sha256: "x", acknowledgments: {} },
    fulfillment: { method: "MAIL_IN", address: { line1: "1 Main St", line2: null, city: "Austin", state: "TX", zip: "73301" }, preferredDate: null },
    rush: false,
    estimate: Money.fromCents(3000 * pairs),
    estimateIsMinimum: false,
    deposit: Money.fromCents(1500 * pairs),
    depositPayment: { method: "ZELLE", amount: Money.fromCents(1500 * pairs) },
    collection: null,
    submissionKey: null,
    submissionFingerprint: null,
    bundleId: null,
    items: Array.from({ length: pairs }, (_, i) => ({
      brand: "Nike",
      model: null,
      description: null,
      material: null,
      serviceIds: ["standard"],
      estimate: Money.fromCents(3000),
      photos: [{ key: `photos/${counter}-${i}.jpg`, uploadKey: `bookings/${counter}-${i}.jpg` }],
    })),
  };
  const { order } = await orders.create(input);
  return { orders, order };
}

/** The form's values as the Order currently has them, with `overrides` applied. */
function rawFor(order: Awaited<ReturnType<typeof bookOrder>>["order"], overrides: Partial<RawOrderDetails> = {}): RawOrderDetails {
  const { address } = order.fulfillment;
  return {
    contactName: order.contactName,
    contactEmail: order.contactEmail,
    contactPhone: order.contactPhone,
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    state: address.state,
    zip: address.zip,
    pairs: order.items.map((item) => ({
      itemId: item.id,
      brand: item.brand ?? "",
      model: item.model ?? "",
      size: item.size ?? "",
      colorway: item.colorway ?? "",
      material: item.material ?? "",
      condition: item.condition ?? "",
      description: item.description ?? "",
    })),
    ...overrides,
  };
}

const save = (orders: InMemoryOrderRepository, order: { id: string; updatedAt: Date }, raw: RawOrderDetails, idempotencyKey = "k1") =>
  updateOrderDetails({ orders }, ADMIN, { orderId: order.id, expectedUpdatedAt: order.updatedAt, raw, idempotencyKey });

describe("cleanOrderDetails", () => {
  it("trims, uppercases the state, and turns empty text into null", async () => {
    const { order } = await bookOrder();
    const raw = rawFor(order, { contactName: "  Sam  ", state: " ny ", line2: "  ", pairs: [{ ...rawFor(order).pairs[0]!, size: " 10 ", brand: "" }] });
    const cleaned = cleanOrderDetails(raw);
    expect(cleaned).toMatchObject({ ok: true, details: { contact: { name: "Sam" }, address: { state: "NY", line2: null } } });
    expect(cleaned.ok && cleaned.details.pairs[0]).toMatchObject({ size: "10", brand: null, model: null });
  });

  it("applies the booking's contact rules and reports each bad field", async () => {
    const { order } = await bookOrder();
    const pairId = order.items[0]!.id;
    const raw = rawFor(order, {
      contactName: " ",
      contactEmail: "nope",
      contactPhone: "123",
      line1: "",
      city: "",
      state: "N",
      zip: "1234",
      pairs: [{ ...rawFor(order).pairs[0]!, size: "x".repeat(21) }],
    });
    const cleaned = cleanOrderDetails(raw);
    expect(cleaned.ok).toBe(false);
    expect(!cleaned.ok && Object.keys(cleaned.errors).sort()).toEqual(
      ["city", "contactEmail", "contactName", "contactPhone", "line1", `pair:${pairId}:size`, "state", "zip"].sort(),
    );
  });
});

describe("updateOrderDetails", () => {
  it("rejects a non-admin caller before touching anything", async () => {
    const { orders, order } = await bookOrder();
    await expect(
      updateOrderDetails({ orders }, CUSTOMER, { orderId: order.id, expectedUpdatedAt: order.updatedAt, raw: rawFor(order, { contactName: "Eve" }), idempotencyKey: "k" }),
    ).rejects.toThrow(UnauthorizedError);
    expect(order.contactName).toBe("Jordan Smith");
  });

  it("returns field errors without writing", async () => {
    const { orders, order } = await bookOrder();
    const result = await save(orders, order, rawFor(order, { contactEmail: "bad" }));
    expect(result).toEqual({ ok: false, errors: { contactEmail: "Enter a valid email address." } });
    expect(orders.auditEntries).toEqual([]);
  });

  it("saves contact, address and pair details together and audits each without customer details", async () => {
    const { orders, order } = await bookOrder(2);
    const before = order.updatedAt;
    const raw = rawFor(order, { contactName: "Sam Lee", line2: "Apt 2", pairs: rawFor(order).pairs.map((pair, i) => (i === 0 ? { ...pair, size: "10", condition: "Good" } : pair)) });

    expect(await save(orders, order, raw)).toEqual({ ok: true, outcome: "updated" });

    expect(order.contactName).toBe("Sam Lee");
    expect(order.fulfillment.address.line2).toBe("Apt 2");
    expect(order.items[0]).toMatchObject({ size: "10", condition: "Good" });
    expect(order.updatedAt.getTime()).toBeGreaterThan(before.getTime());
    expect(orders.auditEntries.map(({ action, itemId, actorAccountId, metadata }) => ({ action, itemId, actorAccountId, metadata }))).toEqual([
      { action: "DETAILS_EDITED", itemId: order.items[0]!.id, actorAccountId: "acc_admin", metadata: { changes: { size: { from: null, to: "10" }, condition: { from: null, to: "Good" } } } },
      { action: "ORDER_CONTACT_EDITED", itemId: order.items[0]!.id, actorAccountId: "acc_admin", metadata: { fields: ["contactName", "address.line2"] } },
    ]);
  });

  it("writes nothing when nothing changed", async () => {
    const { orders, order } = await bookOrder();
    const before = order.updatedAt;
    expect(await save(orders, order, rawFor(order))).toEqual({ ok: true, outcome: "unchanged" });
    expect(order.updatedAt).toBe(before);
    expect(orders.auditEntries).toEqual([]);
  });

  it("applies a retry with the same key once", async () => {
    const { orders, order } = await bookOrder();
    const stale = order.updatedAt;
    const raw = rawFor(order, { contactPhone: "(212) 555-0199" });
    expect(await save(orders, { id: order.id, updatedAt: stale }, raw)).toEqual({ ok: true, outcome: "updated" });
    // The retry carries the old stamp too; the key is what says it already applied.
    expect(await save(orders, { id: order.id, updatedAt: stale }, raw)).toEqual({ ok: true, outcome: "already-applied" });
    expect(orders.auditEntries).toHaveLength(1);
  });

  it("refuses a form rendered before another edit landed", async () => {
    const { orders, order } = await bookOrder();
    const opened = order.updatedAt;
    await save(orders, order, rawFor(order, { contactName: "First Tab" }), "tab-1");
    await expect(save(orders, { id: order.id, updatedAt: opened }, rawFor(order, { contactName: "Second Tab" }), "tab-2")).rejects.toThrow(OrderChangedError);
    expect(order.contactName).toBe("First Tab");
  });

  it("doesn't change the fulfillment method, dates, or the Account's email", async () => {
    const { orders, order } = await bookOrder();
    const accountEmail = orders.accounts.accounts.find((account) => account.id === order.accountId)!.email;
    await save(orders, order, rawFor(order, { contactEmail: "other@example.com" }));
    expect(order.fulfillment).toMatchObject({ method: "MAIL_IN", preferredDate: null });
    expect(order.contactEmail).toBe("other@example.com");
    // ADR-0014: the Order's contact email is a copy; the sign-in email is the Account's own.
    expect(orders.accounts.accounts.find((account) => account.id === order.accountId)!.email).toBe(accountEmail);
  });

  it("names a missing order or a pair from elsewhere", async () => {
    const { orders, order } = await bookOrder();
    await expect(updateOrderDetails({ orders }, ADMIN, { orderId: "nope", expectedUpdatedAt: new Date(), raw: rawFor(order), idempotencyKey: "k" })).rejects.toThrow(OrderNotFoundError);
    const raw = rawFor(order);
    raw.pairs.push({ ...raw.pairs[0]!, itemId: "someone-elses" });
    await expect(save(orders, order, raw)).rejects.toThrow(ItemNotFoundError);
  });
});

describe("addOrderNote", () => {
  it("rejects a non-admin caller", async () => {
    const { orders, order } = await bookOrder();
    await expect(addOrderNote({ orders }, CUSTOMER, { orderId: order.id, body: "hi" })).rejects.toThrow(UnauthorizedError);
  });

  it("trims and stores the note against the Order", async () => {
    const { orders, order } = await bookOrder();
    const result = await addOrderNote({ orders }, ADMIN, { orderId: order.id, body: "  Call before 5pm.  " });
    expect(result).toMatchObject({ ok: true, note: { body: "Call before 5pm." } });
    expect((await orders.listOrderNotes(order.id)).map((note) => note.body)).toEqual(["Call before 5pm."]);
  });

  it("refuses an empty or over-long note", async () => {
    const { orders, order } = await bookOrder();
    expect(await addOrderNote({ orders }, ADMIN, { orderId: order.id, body: "   " })).toEqual({ ok: false, error: "Write a note first." });
    expect(await addOrderNote({ orders }, ADMIN, { orderId: order.id, body: "x".repeat(2001) })).toMatchObject({ ok: false });
    expect(await orders.listOrderNotes(order.id)).toEqual([]);
  });

  it("names a missing order", async () => {
    const { orders } = await bookOrder();
    await expect(addOrderNote({ orders }, ADMIN, { orderId: "nope", body: "hi" })).rejects.toThrow(OrderNotFoundError);
  });
});
