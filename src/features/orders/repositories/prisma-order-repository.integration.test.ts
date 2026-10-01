// Proves the repository seam against a REAL Postgres — not mocked — per
// Phase 0's "repository and migration integration tests" requirement.
// Requires TEST_DATABASE_URL (see .env.example); run with `npm run test:integration`.

import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Money } from "@/shared/money/money";
import {
  AppointmentCancelledError,
  AppointmentMovedError,
  AppointmentNotFoundError,
  AppointmentNotScheduledError,
  OrderNotFoundError,
  ReturnAlreadyBookedError,
  BundleNotFoundError,
  EmailTakenError,
  ItemNotFoundError,
  ItemStatusChangedError,
  NoPendingDepositError,
  OrderChangedError,
  PhotoKeyInUseError,
  type NewItemInput,
  type NewOrderInput,
} from "./order-repository";
import { deleteAllOrders } from "@/shared/testing/delete-all-orders";
import { PrismaOrderRepository } from "./prisma-order-repository";

const prisma = new PrismaClient();
const repo = new PrismaOrderRepository(prisma);

beforeEach(async () => {
  await deleteAllOrders(prisma);
  await prisma.signInCode.deleteMany();
  await prisma.account.deleteMany({ where: { role: "CUSTOMER" } });
});

let counter = 0;
/** A fresh new-customer owner per call, so tests don't collide on email. */
function newCustomer(email = `customer${++counter}@example.com`) {
  return { newCustomer: { email, phone: "2125550142" } };
}
/** Fresh photos per call: both item_photos.key and .uploadKey are unique. */
function photos(n = 1) {
  counter += 1;
  return Array.from({ length: n }, (_, i) => ({
    key: `photos/run-${counter}/${i}.jpg`,
    uploadKey: `bookings/run-${counter}/${i}.jpg`,
  }));
}

afterAll(async () => {
  await prisma.$disconnect();
});

const TERMS = {
  version: "2026-09-27-v1",
  url: "/legal/terms/2026-09-27-v1.pdf",
  sha256: "65c9ad00d15279d81fb433299e235176281ea12efd8d141826066b1528395874",
  acknowledgments: { pricing: true, restorationResults: true, materialRisks: true, structuralLimitations: true },
};

function newOrder(overrides: Partial<NewOrderInput> = {}): NewOrderInput {
  return {
    owner: newCustomer(),
    contactName: "Jordan Smith",
    contactEmail: "customer@example.com",
    contactPhone: "2125550142",
    policyAcceptedAt: new Date(),
    terms: TERMS,
    fulfillment: {
      method: "PICKUP",
      address: { line1: "123 Main St", line2: "Apt 4B", city: "New York", state: "NY", zip: "10001" },
      date: "2026-10-03",
      slot: "4:30 PM – 5:00 PM",
    },
    rush: false,
    estimate: Money.fromCents(3000),
    estimateIsMinimum: false,
    deposit: Money.fromCents(1500),
    depositPayment: { method: "ZELLE", amount: Money.fromCents(1500) },
    collection: { startsAt: new Date("2026-10-03T20:30:00Z"), endsAt: new Date("2026-10-03T21:00:00Z") },
    submissionKey: null,
    submissionFingerprint: null,
    bundleId: null,
    items: [newItem()],
    ...overrides,
  };
}

function newItem(overrides: Partial<NewItemInput> = {}): NewItemInput {
  return {
    brand: null,
    model: null,
    description: null,
    material: null,
    serviceIds: ["standard"],
    estimate: Money.fromCents(3000),
    photos: photos(),
    ...overrides,
  };
}

describe("PrismaOrderRepository (integration)", () => {
  it("persists a new order with its item and round-trips domain types", async () => {
    const { order, created } = await repo.create(
      newOrder({
        rush: true,
        estimate: Money.fromCents(5000),
        deposit: Money.fromCents(2500),
        items: [
          {
            brand: "Nike Air Max",
            model: null,
            description: "scuffed",
            material: "Suede",
            serviceIds: ["standard"],
            estimate: Money.fromCents(4000),
            photos: [
              { key: "photos/k/1.jpg", uploadKey: "bookings/k/1.jpg" },
              { key: "photos/k/2.jpg", uploadKey: "bookings/k/2.jpg" },
            ],
          },
        ],
      }),
    );

    expect(created).toBe(true);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]?.status).toBe("REQUEST_SUBMITTED");
    expect(order.items[0]?.price).toBeNull();

    const reloaded = await repo.findById(order.id);
    expect(reloaded?.items[0]?.photoKeys).toEqual(["photos/k/1.jpg", "photos/k/2.jpg"]);
    expect(reloaded?.items[0]?.serviceIds).toEqual(["standard"]);
    expect(reloaded?.items[0]?.material).toBe("Suede");
    expect(reloaded?.items[0]?.estimate.cents).toBe(4000);
    expect(reloaded?.contactName).toBe("Jordan Smith");
    expect(reloaded?.rush).toBe(true);
    expect(reloaded?.estimate.cents).toBe(5000);
    expect(reloaded?.deposit.cents).toBe(2500);
  });

  it("keeps the terms acceptance with the Order: version, URL, SHA-256, acknowledgments and when (ADR-0015)", async () => {
    const acceptedAt = new Date("2026-09-27T23:48:32.000Z");
    const { order } = await repo.create(newOrder({ policyAcceptedAt: acceptedAt }));
    const found = await repo.findById(order.id);
    expect(found?.termsAcceptance).toEqual({ ...TERMS, acceptedAt });
  });

  it("reads an Order from before the agreement existed as having no terms acceptance", async () => {
    const { order } = await repo.create(newOrder());
    await prisma.order.update({
      where: { id: order.id },
      data: { termsVersion: null, termsUrl: null, termsSha256: null, termsAcknowledgments: Prisma.DbNull },
    });
    expect((await repo.findById(order.id))?.termsAcceptance).toBeNull();
  });

  it("stores Pickup dates as calendar dates, with no timezone shift", async () => {
    const { order } = await repo.create(newOrder());
    const reloaded = await repo.findById(order.id);
    expect(reloaded?.fulfillment).toEqual({
      method: "PICKUP",
      address: { line1: "123 Main St", line2: "Apt 4B", city: "New York", state: "NY", zip: "10001" },
      date: "2026-10-03",
      slot: "4:30 PM – 5:00 PM",
    });
  });

  it("round-trips a Mail-In order with and without a preferred date", async () => {
    const address = { line1: "1 Elm St", line2: null, city: "Austin", state: "TX", zip: "73301" };
    const withDate = await repo.create(
      newOrder({ fulfillment: { method: "MAIL_IN", address, preferredDate: "2026-11-15" } }),
    );
    const withoutDate = await repo.create(newOrder({ fulfillment: { method: "MAIL_IN", address, preferredDate: null } }));

    expect((await repo.findById(withDate.order.id))?.fulfillment).toEqual({
      method: "MAIL_IN",
      address,
      preferredDate: "2026-11-15",
    });
    expect((await repo.findById(withoutDate.order.id))?.fulfillment).toMatchObject({ preferredDate: null });
  });

  it("creates the new customer's Account with the Order", async () => {
    const { order } = await repo.create(newOrder({ owner: newCustomer("new@example.com") }));
    const account = await prisma.account.findUniqueOrThrow({ where: { id: order.accountId } });
    expect(account).toMatchObject({ email: "new@example.com", phone: "2125550142", role: "CUSTOMER" });
  });

  it("reports a taken customer email as EmailTakenError, and writes nothing", async () => {
    await repo.create(newOrder({ owner: newCustomer("taken@example.com") }));
    await expect(repo.create(newOrder({ owner: newCustomer("taken@example.com") }))).rejects.toThrow(EmailTakenError);
    expect(await prisma.order.count()).toBe(1);
  });

  it("keeps Admin and Customer Accounts separate: an admin's email can have its own Customer Account", async () => {
    const admin = await prisma.account.create({ data: { role: "ADMIN", email: "owner-it@example.com" } });
    try {
      const { order } = await repo.create(newOrder({ owner: newCustomer("owner-it@example.com") }));
      expect(order.accountId).not.toBe(admin.id);
      expect(await prisma.account.count({ where: { email: "owner-it@example.com" } })).toBe(2);
    } finally {
      await deleteAllOrders(prisma);
      await prisma.account.delete({ where: { id: admin.id } });
    }
  });

  it("stores a Bundle's three pairs in the order given, with the Bundle id", async () => {
    const pairs = ["Pair A", "Pair B", "Pair C"].map((brand, i) =>
      newItem({ brand, serviceIds: ["premium"], estimate: Money.fromCents(i === 0 ? 5834 : 5833) }),
    );
    const { order } = await repo.create(
      newOrder({ bundleId: "restoration", items: pairs, estimate: Money.fromCents(17500), deposit: Money.fromCents(8750) }),
    );
    const reloaded = await repo.findById(order.id);
    expect(reloaded?.bundleId).toBe("restoration");
    expect(reloaded?.items.map((item) => item.brand)).toEqual(["Pair A", "Pair B", "Pair C"]);
    expect(reloaded?.items.map((item) => item.estimate.cents)).toEqual([5834, 5833, 5833]);
  });

  it("writes nothing when one pair of a booking reuses another pair's upload", async () => {
    const [shared] = photos();
    const attempt = repo.create(
      newOrder({
        items: [
          newItem({ photos: [{ key: "photos/dup/0.jpg", uploadKey: shared!.uploadKey }] }),
          newItem({ photos: [{ key: "photos/dup/1.jpg", uploadKey: shared!.uploadKey }] }),
        ],
      }),
    );
    await expect(attempt).rejects.toBeInstanceOf(PhotoKeyInUseError);
    expect(await prisma.order.count()).toBe(0);
  });

  it("books into an existing Account by id", async () => {
    const first = await repo.create(newOrder());
    const second = await repo.create(newOrder({ owner: { accountId: first.order.accountId } }));
    expect(second.order.accountId).toBe(first.order.accountId);
  });

  it("stores photos in order and round-trips them", async () => {
    const three = photos(3);
    const { order } = await repo.create(newOrder({ items: [newItem({ photos: three })] }));
    expect((await repo.findById(order.id))?.items[0]?.photoKeys).toEqual(three.map((p) => p.key));
  });

  it("lets exactly one of two concurrent bookings claim an upload (20 runs)", async () => {
    for (let run = 0; run < 20; run++) {
      // Same upload, each booking with its own copy, as submitOrder makes them.
      const [upload] = photos();
      const results = await Promise.allSettled([
        repo.create(newOrder({ items: [newItem({ photos: [{ key: `${upload!.key}.a`, uploadKey: upload!.uploadKey }] })] })),
        repo.create(newOrder({ items: [newItem({ photos: [{ key: `${upload!.key}.b`, uploadKey: upload!.uploadKey }] })] })),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(PhotoKeyInUseError);
      expect(await prisma.itemPhoto.count({ where: { uploadKey: upload!.uploadKey } })).toBe(1);
    }
  });

  it("stores the submission fingerprint with the key and finds the Order by key", async () => {
    const { order } = await repo.create(newOrder({ submissionKey: "fp-key", submissionFingerprint: "abc123" }));
    expect((await repo.findBySubmissionKey("fp-key"))?.id).toBe(order.id);
    expect((await repo.findById(order.id))?.submissionFingerprint).toBe("abc123");
  });

  it("returns the existing order for a repeated submissionKey instead of inserting a duplicate", async () => {
    const first = await repo.create(newOrder({ submissionKey: "booking-1" }));
    const retry = await repo.create(newOrder({ submissionKey: "booking-1" }));

    expect(retry.created).toBe(false);
    expect(retry.order.id).toBe(first.order.id);
    expect(await prisma.order.count()).toBe(1);
  });

  it("records when the confirmation email was sent", async () => {
    const { order } = await repo.create(newOrder());
    expect(order.confirmationEmailSentAt).toBeNull();

    const sentAt = new Date("2026-10-01T15:00:00Z");
    await repo.markConfirmationEmailSent(order.id, sentAt);
    expect((await repo.findById(order.id))?.confirmationEmailSentAt).toEqual(sentAt);
  });

  it("dedupes concurrent submits with the same key", async () => {
    const results = await Promise.all([
      repo.create(newOrder({ submissionKey: "booking-2" })),
      repo.create(newOrder({ submissionKey: "booking-2" })),
    ]);

    expect(new Set(results.map((r) => r.order.id)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(await prisma.order.count()).toBe(1);
  });

  it("transitions an item's status and writes one audit entry, transactionally", async () => {
    const { order } = await repo.create(newOrder());
    const itemId = order.items[0]!.id;

    const updated = await repo.transitionItemStatus({
      itemId,
      toStatus: "UNDER_REVIEW",
      entry: { action: "REVIEW_STARTED", fromStatus: "REQUEST_SUBMITTED", toStatus: "UNDER_REVIEW", actorAccountId: null, idempotencyKey: null },
    });

    expect(updated?.status).toBe("UNDER_REVIEW");
    const entries = await prisma.itemAuditEntry.findMany({ where: { itemId } });
    expect(entries).toHaveLength(1);
  });

  it("refuses a missing item or a stale fromStatus, writing no audit entry", async () => {
    const { order } = await repo.create(newOrder());
    const itemId = order.items[0]!.id;
    const entry = (fromStatus: "REQUEST_SUBMITTED" | "QUOTE_SENT") => ({
      action: "X",
      fromStatus,
      toStatus: "UNDER_REVIEW" as const,
      actorAccountId: null,
      idempotencyKey: null,
    });

    await expect(repo.transitionItemStatus({ itemId: "item_missing", toStatus: "UNDER_REVIEW", entry: entry("REQUEST_SUBMITTED") })).rejects.toThrow(
      ItemNotFoundError,
    );
    await expect(repo.transitionItemStatus({ itemId, toStatus: "UNDER_REVIEW", entry: entry("QUOTE_SENT") })).rejects.toThrow(
      ItemStatusChangedError,
    );
    expect((await repo.findById(order.id))?.items[0]?.status).toBe("REQUEST_SUBMITTED");
    expect(await prisma.itemAuditEntry.count({ where: { itemId } })).toBe(0);
  });

  it("is idempotent at the database level: a repeated key is a no-op, not a duplicate audit row", async () => {
    const { order } = await repo.create(newOrder());
    const itemId = order.items[0]!.id;
    const entry = {
      action: "MANUAL_PAYMENT_CONFIRMED",
      fromStatus: "REQUEST_SUBMITTED" as const,
      toStatus: "UNDER_REVIEW" as const,
      actorAccountId: null,
      idempotencyKey: "confirm-1",
    };

    await repo.transitionItemStatus({ itemId, toStatus: "UNDER_REVIEW", entry });
    const retry = await repo.transitionItemStatus({ itemId, toStatus: "UNDER_REVIEW", entry });

    expect(retry).toBeNull();
    const entries = await prisma.itemAuditEntry.findMany({ where: { itemId } });
    expect(entries).toHaveLength(1);
  });
});

describe("PrismaOrderRepository admin Overview reads (integration)", () => {
  const transition = (itemId: string, action: string, fromStatus: "REQUEST_SUBMITTED" | "UNDER_REVIEW", toStatus: "UNDER_REVIEW" | "CANCELLED") =>
    repo.transitionItemStatus({ itemId, toStatus, entry: { action, fromStatus, toStatus, actorAccountId: null, idempotencyKey: null } });

  it("lists the Orders booked in [from, to), oldest first", async () => {
    const early = (await repo.create(newOrder())).order;
    const late = (await repo.create(newOrder())).order;
    const outside = (await repo.create(newOrder())).order;
    await prisma.order.update({ where: { id: early.id }, data: { createdAt: new Date("2026-09-28T05:00:00Z") } });
    await prisma.order.update({ where: { id: late.id }, data: { createdAt: new Date("2026-09-29T05:00:00Z") } });
    await prisma.order.update({ where: { id: outside.id }, data: { createdAt: new Date("2026-09-30T04:00:00Z") } });

    const booked = await repo.listBookedBetween(new Date("2026-09-28T04:00:00Z"), new Date("2026-09-30T04:00:00Z"));

    expect(booked.map((order) => order.id)).toEqual([early.id, late.id]);
    expect(booked[0]?.items).toHaveLength(1);
  });

  it("totals the Orders booked in [from, to) without loading them, leaving cancelled pairs out", async () => {
    const at = (order: { id: string }, iso: string) => prisma.order.update({ where: { id: order.id }, data: { createdAt: new Date(iso) } });
    const whole = (await repo.create(newOrder({ estimate: Money.fromCents(3000) }))).order;
    const partly = (await repo.create(newOrder({ estimate: Money.fromCents(9000), items: [newItem(), newItem({ estimate: Money.fromCents(3000) })] }))).order;
    const gone = (await repo.create(newOrder({ estimate: Money.fromCents(4000) }))).order;
    const outside = (await repo.create(newOrder({ estimate: Money.fromCents(7000) }))).order;
    await at(whole, "2026-09-28T15:00:00Z");
    await at(partly, "2026-09-28T16:00:00Z");
    await at(gone, "2026-09-28T17:00:00Z");
    await at(outside, "2026-09-30T15:00:00Z");
    await transition(partly.items[1]!.id, "CANCELLED", "REQUEST_SUBMITTED", "CANCELLED");
    await transition(gone.items[0]!.id, "CANCELLED", "REQUEST_SUBMITTED", "CANCELLED");

    const summary = await repo.summarizeBookedBetween(new Date("2026-09-28T04:00:00Z"), new Date("2026-09-30T04:00:00Z"));

    expect(summary.orders).toBe(2);
    expect(summary.value.cents).toBe(3000 + (9000 - 3000));
  });

  it("lists the most recent Orders, newest first", async () => {
    const orders = [];
    for (const day of ["2026-09-20", "2026-09-22", "2026-09-21"]) {
      const { order } = await repo.create(newOrder());
      await prisma.order.update({ where: { id: order.id }, data: { createdAt: new Date(`${day}T15:00:00Z`) } });
      orders.push(order);
    }

    const recent = await repo.listRecent(2);

    expect(recent.map((order) => order.id)).toEqual([orders[1]!.id, orders[2]!.id]);
  });

  it("finds the SCHEDULED Appointments starting in [from, to), earliest first, with their Order", async () => {
    const collected = (await repo.create(newOrder({ contactName: "John Doe" }))).order; // collection Oct 3, 4:30 PM EDT
    const nextDay = (await repo.create(newOrder({ collection: { startsAt: new Date("2026-10-04T20:30:00Z"), endsAt: new Date("2026-10-04T21:00:00Z") } }))).order;
    const calledOff = (await repo.create(newOrder())).order;
    await prisma.appointment.updateMany({ where: { orderId: calledOff.id }, data: { status: "CANCELLED" } });
    await prisma.appointment.create({
      data: { orderId: collected.id, kind: "RETURN", startsAt: new Date("2026-10-03T14:00:00Z"), endsAt: new Date("2026-10-03T14:30:00Z") },
    });

    const visits = await repo.listAppointmentsBetween(new Date("2026-10-03T04:00:00Z"), new Date("2026-10-04T04:00:00Z"));

    expect(visits.map((visit) => [visit.kind, visit.order.id])).toEqual([
      ["RETURN", collected.id],
      ["COLLECTION", collected.id],
    ]);
    expect(visits[0]!.order).toMatchObject({ number: collected.number, contactName: "John Doe", itemStatuses: ["REQUEST_SUBMITTED"] });
    expect(visits.some((visit) => visit.order.id === nextDay.id)).toBe(false);
  });

  it("counts Items by status", async () => {
    const { order } = await repo.create(newOrder({ items: [newItem(), newItem(), newItem()] }));
    await transition(order.items[0]!.id, "REVIEW_STARTED", "REQUEST_SUBMITTED", "UNDER_REVIEW");

    expect(await repo.countItemsByStatus()).toEqual({ REQUEST_SUBMITTED: 2, UNDER_REVIEW: 1 });
  });

  it("sums the PENDING Deposits by method, skipping received ones and fully cancelled Orders", async () => {
    await repo.create(newOrder({ deposit: Money.fromCents(1500) }));
    await repo.create(newOrder({ deposit: Money.fromCents(2500), depositPayment: { method: "CASH", amount: Money.fromCents(2500) } }));
    const paid = (await repo.create(newOrder({ deposit: Money.fromCents(4000) }))).order;
    await prisma.payment.updateMany({ where: { orderId: paid.id }, data: { status: "RECEIVED", receivedAt: new Date() } });
    const cancelled = (await repo.create(newOrder({ deposit: Money.fromCents(8000) }))).order;
    await transition(cancelled.items[0]!.id, "CANCELLED", "REQUEST_SUBMITTED", "CANCELLED");

    const summary = await repo.summarizeAwaitingDeposit();

    expect(summary.orders).toBe(2);
    expect(summary.deposits.cents).toBe(4000);
    expect(summary.byMethod).toEqual({ ZELLE: 1, CASH: 1, CARD: 0, APPLE_PAY: 0 });
  });
});

describe("PrismaOrderRepository admin-screen data (integration)", () => {
  it("numbers Orders in sequence and creates the PENDING Deposit and collection Appointment with them", async () => {
    const first = (await repo.create(newOrder({ contactName: "John Doe" }))).order;
    const second = (await repo.create(newOrder())).order;

    expect(second.number).toBe(first.number + 1);
    expect(first.payments).toEqual([
      expect.objectContaining({ kind: "DEPOSIT", method: "ZELLE", amount: Money.fromCents(1500), status: "PENDING", receivedAt: null }),
    ]);
    expect(first.appointments).toEqual([
      expect.objectContaining({ kind: "COLLECTION", startsAt: new Date("2026-10-03T20:30:00Z"), endsAt: new Date("2026-10-03T21:00:00Z") }),
    ]);
    expect((await prisma.account.findUniqueOrThrow({ where: { id: first.accountId } })).name).toBe("John Doe");
    expect(first.items[0]).toMatchObject({ size: null, colorway: null });
    expect(first.dropOffFee.cents).toBe(0);
  });

  it("gives a Mail-In Order no collection Appointment", async () => {
    const { order } = await repo.create(
      newOrder({
        fulfillment: { method: "MAIL_IN", address: { line1: "1 Main St", line2: null, city: "Austin", state: "TX", zip: "73301" }, preferredDate: null },
        collection: null,
      }),
    );
    expect(order.appointments).toEqual([]);
  });

  it("links an Order to its Bundle, and refuses a Bundle that doesn't exist", async () => {
    const { order } = await repo.create(newOrder({ bundleId: "revival" }));
    expect(order.bundleId).toBe("revival");
    await expect(repo.create(newOrder({ bundleId: "no-such-bundle" }))).rejects.toThrow();
  });

  it("enforces the money, time and stock rules in the database itself", async () => {
    const { order } = await repo.create(newOrder());
    await expect(prisma.payment.create({ data: { orderId: order.id, kind: "BALANCE", method: "CASH", amountCents: 0 } })).rejects.toThrow();
    // RECEIVED exactly when there's a receivedAt.
    await expect(prisma.payment.create({ data: { orderId: order.id, kind: "BALANCE", method: "CASH", amountCents: 100, status: "RECEIVED" } })).rejects.toThrow();
    await expect(
      prisma.appointment.create({ data: { orderId: order.id, kind: "RETURN", startsAt: new Date("2026-10-05T15:00:00Z"), endsAt: new Date("2026-10-05T15:00:00Z") } }),
    ).rejects.toThrow();
    // One COLLECTION per Order: rescheduling moves it rather than adding another.
    await expect(
      prisma.appointment.create({ data: { orderId: order.id, kind: "COLLECTION", startsAt: new Date("2026-10-05T15:00:00Z"), endsAt: new Date("2026-10-05T15:30:00Z") } }),
    ).rejects.toThrow();
    const item = await prisma.inventoryItem.create({ data: { name: "Crep Protect Spray", category: "Cleaning", stock: 1 } });
    try {
      await expect(prisma.inventoryItem.update({ where: { id: item.id }, data: { stock: { decrement: 2 } } })).rejects.toThrow();
    } finally {
      await prisma.inventoryItem.delete({ where: { id: item.id } });
    }
  });

  it("keeps Conversations per customer, with or without an Order, and counts unread messages", async () => {
    const { order } = await repo.create(newOrder());
    const aboutOrder = await prisma.conversation.create({ data: { accountId: order.accountId, orderId: order.id, subject: "Pickup time confirmation" } });
    const inquiry = await prisma.conversation.create({ data: { accountId: order.accountId, subject: "Do you offer pickup in Queens?" } });
    const question = await prisma.message.create({ data: { conversationId: aboutOrder.id, author: "CUSTOMER", body: "Can you add sole restoration?" } });
    await prisma.messageAttachment.create({ data: { messageId: question.id, key: "messages/a/1.jpg", filename: "sole.jpg", contentType: "image/jpeg" } });
    await prisma.message.create({ data: { conversationId: aboutOrder.id, author: "ADMIN", body: "Yes, that's $25 more.", channel: "SMS" } });
    await prisma.message.create({ data: { conversationId: inquiry.id, author: "CUSTOMER", body: "Queens?" } });

    const unread = await prisma.message.count({ where: { author: "CUSTOMER", readAt: null, conversation: { archivedAt: null } } });
    expect(unread).toBe(2);
  });
});

describe("admin-screen data: reviews, notes, stock, payments (integration)", () => {
  it("allows one Review per Order, rated 1 to 5, with photos", async () => {
    const { order } = await repo.create(newOrder());
    const review = await prisma.review.create({
      data: { accountId: order.accountId, orderId: order.id, rating: 5, body: "Brand new again!", photos: { create: [{ key: "reviews/r/1.jpg", position: 0 }] } },
      include: { photos: true },
    });
    expect(review).toMatchObject({ status: "PENDING", photos: [expect.objectContaining({ key: "reviews/r/1.jpg" })] });

    await expect(prisma.review.create({ data: { accountId: order.accountId, orderId: order.id, rating: 4, body: "Again" } })).rejects.toThrow();
    await expect(prisma.review.create({ data: { accountId: order.accountId, rating: 6, body: "Too good" } })).rejects.toThrow();
    await expect(prisma.review.create({ data: { accountId: order.accountId, rating: 0, body: "Nope" } })).rejects.toThrow();
  });

  it("records refunds and failures consistently", async () => {
    const { order } = await repo.create(newOrder());
    const now = new Date();
    await expect(
      prisma.payment.create({ data: { orderId: order.id, kind: "BALANCE", method: "APPLE_PAY", amountCents: 1500, status: "REFUNDED", receivedAt: now, refundedAt: now, reference: "ch_3N8f" } }),
    ).resolves.toBeTruthy();
    await expect(prisma.payment.create({ data: { orderId: order.id, kind: "BALANCE", method: "CARD", amountCents: 1500, status: "FAILED", failureReason: "card_declined" } })).resolves.toBeTruthy();
    // A refund must have been received first, and has its own date.
    await expect(prisma.payment.create({ data: { orderId: order.id, kind: "BALANCE", method: "CARD", amountCents: 1500, status: "REFUNDED", refundedAt: now } })).rejects.toThrow();
    await expect(prisma.payment.create({ data: { orderId: order.id, kind: "BALANCE", method: "CARD", amountCents: 1500, status: "RECEIVED", receivedAt: now, refundedAt: now } })).rejects.toThrow();
  });

  it("keeps notes on a customer, optionally about an Order, and a notification for the bell", async () => {
    const { order } = await repo.create(newOrder());
    await prisma.note.create({ data: { accountId: order.accountId, orderId: order.id, body: "Extra care on the midsole." } });
    await prisma.note.create({ data: { accountId: order.accountId, body: "Always on time for collections." } });
    await prisma.notification.create({ data: { kind: "NEW_BOOKING", title: "New booking", orderId: order.id } });

    expect(await prisma.note.count({ where: { accountId: order.accountId } })).toBe(2);
    expect(await prisma.notification.count({ where: { readAt: null } })).toBe(1);
  });

  it("tracks stock changes, never a zero change, with unique SKUs", async () => {
    const item = await prisma.inventoryItem.create({ data: { name: "Crep Protect Spray", sku: "ATU-CP-IT", category: "Cleaning", stock: 12, lowStockAt: 5, unitCostCents: 850 } });
    try {
      await prisma.stockMovement.create({ data: { itemId: item.id, change: -2, reason: "USED" } });
      await expect(prisma.stockMovement.create({ data: { itemId: item.id, change: 0, reason: "ADJUSTMENT" } })).rejects.toThrow();
      await expect(prisma.inventoryItem.create({ data: { name: "Duplicate", sku: "ATU-CP-IT", category: "Cleaning" } })).rejects.toThrow();
      await expect(prisma.inventoryItem.update({ where: { id: item.id }, data: { unitCostCents: -1 } })).rejects.toThrow();
    } finally {
      await prisma.stockMovement.deleteMany({ where: { itemId: item.id } });
      await prisma.inventoryItem.delete({ where: { id: item.id } });
    }
  });

  it("gives Appointments a status and an optional assignee", async () => {
    const { order } = await repo.create(newOrder());
    const collection = await prisma.appointment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(collection).toMatchObject({ status: "SCHEDULED", assignedToAccountId: null });
  });
});

describe("PrismaOrderRepository review fixes (integration)", () => {
  it("settles the Order's PENDING Deposit in the same transaction as a payment confirmation, once", async () => {
    const { order } = await repo.create(newOrder());
    const itemId = order.items[0]!.id;
    const confirm = () =>
      repo.transitionItemStatus({
        itemId,
        toStatus: "UNDER_REVIEW",
        entry: { action: "MANUAL_PAYMENT_CONFIRMED", fromStatus: "REQUEST_SUBMITTED", toStatus: "UNDER_REVIEW", actorAccountId: null, idempotencyKey: "confirm-1" },
        receivesDeposit: true,
      });

    await confirm();
    const retry = await confirm();

    const deposit = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id, kind: "DEPOSIT" } });
    expect(retry).toBeNull();
    expect(deposit).toMatchObject({ status: "RECEIVED", idempotencyKey: "confirm-1" });
    expect(deposit.receivedAt).toBeInstanceOf(Date);
    expect((await repo.summarizeAwaitingDeposit()).orders).toBe(0);
  });

  it("leaves the Deposit alone on other transitions", async () => {
    const { order } = await repo.create(newOrder());
    await repo.transitionItemStatus({
      itemId: order.items[0]!.id,
      toStatus: "UNDER_REVIEW",
      entry: { action: "REVIEW_STARTED", fromStatus: "REQUEST_SUBMITTED", toStatus: "UNDER_REVIEW", actorAccountId: null, idempotencyKey: null },
    });
    expect((await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe("PENDING");
  });

  it("refuses a Bundle the bundles table doesn't have, as BundleNotFoundError, having written nothing", async () => {
    const before = await prisma.order.count();
    await expect(repo.create(newOrder({ bundleId: "no-such-bundle" }))).rejects.toThrow(BundleNotFoundError);
    expect(await prisma.order.count()).toBe(before);
  });

  it("won't let a Bundle that Orders name be deleted (deactivate it instead)", async () => {
    await repo.create(newOrder({ bundleId: "revival" }));
    await expect(prisma.bundle.delete({ where: { id: "revival" } })).rejects.toThrow();
  });

  it("allows one active Deposit per Order, but a retry after a failed one", async () => {
    const { order } = await repo.create(newOrder()); // its PENDING Deposit
    await expect(prisma.payment.create({ data: { orderId: order.id, kind: "DEPOSIT", method: "CASH", amountCents: 1500 } })).rejects.toThrow();

    await prisma.payment.updateMany({ where: { orderId: order.id }, data: { status: "FAILED", failureReason: "card_declined" } });
    await expect(prisma.payment.create({ data: { orderId: order.id, kind: "DEPOSIT", method: "CARD", amountCents: 1500 } })).resolves.toBeTruthy();
  });

  it("finds an Appointment of any status with its whole Order and notes, or null", async () => {
    const { order } = await repo.create(newOrder({ contactName: "John Doe" }));
    const appointmentId = order.appointments[0]!.id;
    await prisma.appointment.update({ where: { id: appointmentId }, data: { status: "CANCELLED", notes: "Gate code 4411" } });

    const found = await repo.findAppointment(appointmentId);

    expect(found?.appointment).toMatchObject({ id: appointmentId, kind: "COLLECTION", status: "CANCELLED", notes: "Gate code 4411" });
    expect(found?.order).toMatchObject({ id: order.id, contactName: "John Doe" });
    expect(found?.order.items).toHaveLength(1);
    expect(await repo.findAppointment("no-such-appointment")).toBeNull();
  });

  it("completes a SCHEDULED Appointment, idempotently, and never a cancelled or missing one", async () => {
    const { order } = await repo.create(newOrder());
    const appointmentId = order.appointments[0]!.id;

    expect((await repo.completeAppointment(appointmentId)).status).toBe("COMPLETED");
    expect((await repo.completeAppointment(appointmentId)).status).toBe("COMPLETED");
    // Only the Appointment moves: the pair's status is transitionItemStatus's business.
    expect((await repo.findById(order.id))!.items[0]!.status).toBe("REQUEST_SUBMITTED");

    const calledOff = (await repo.create(newOrder())).order.appointments[0]!.id;
    await prisma.appointment.update({ where: { id: calledOff }, data: { status: "CANCELLED" } });
    await expect(repo.completeAppointment(calledOff)).rejects.toThrow(AppointmentCancelledError);
    expect((await repo.findAppointment(calledOff))!.appointment.status).toBe("CANCELLED");
    await expect(repo.completeAppointment("no-such-appointment")).rejects.toThrow(AppointmentNotFoundError);
  });
});

describe("PrismaOrderRepository reschedule and Return booking (integration)", () => {
  const OLD = new Date("2026-10-03T20:30:00Z");
  const NEW = { startsAt: new Date("2026-10-04T13:00:00Z"), endsAt: new Date("2026-10-04T13:30:00Z") };

  it("moves only a SCHEDULED visit from the time the caller saw, and replays as unchanged", async () => {
    const { order } = await repo.create(newOrder());
    const appointmentId = order.appointments[0]!.id;

    const moved = await repo.rescheduleAppointment({ appointmentId, expectedStartsAt: OLD, ...NEW });
    expect(moved.changed).toBe(true);
    expect(moved.appointment.startsAt).toEqual(NEW.startsAt);
    // The Order keeps the collection time the customer booked.
    expect((await repo.findById(order.id))!.fulfillment).toMatchObject({ date: "2026-10-03", slot: "4:30 PM – 5:00 PM" });

    expect((await repo.rescheduleAppointment({ appointmentId, expectedStartsAt: OLD, ...NEW })).changed).toBe(false);
    await expect(
      repo.rescheduleAppointment({ appointmentId, expectedStartsAt: OLD, startsAt: new Date("2026-10-05T13:00:00Z"), endsAt: new Date("2026-10-05T13:30:00Z") }),
    ).rejects.toThrow(AppointmentMovedError);
    await expect(repo.rescheduleAppointment({ appointmentId: "nope", expectedStartsAt: OLD, ...NEW })).rejects.toThrow(AppointmentNotFoundError);

    for (const status of ["COMPLETED", "CANCELLED"] as const) {
      await prisma.appointment.update({ where: { id: appointmentId }, data: { status } });
      await expect(repo.rescheduleAppointment({ appointmentId, expectedStartsAt: NEW.startsAt, ...OLDWINDOW() })).rejects.toThrow(AppointmentNotScheduledError);
    }
  });

  function OLDWINDOW() {
    return { startsAt: new Date("2026-10-06T13:00:00Z"), endsAt: new Date("2026-10-06T13:30:00Z") };
  }

  it("books one RETURN, treats a same-time replay as unchanged, reuses a CANCELLED row, and refuses a second", async () => {
    const { order } = await repo.create(newOrder());

    const first = await repo.bookReturnAppointment({ orderId: order.id, ...NEW });
    expect(first).toMatchObject({ created: true, appointment: { kind: "RETURN", status: "SCHEDULED" } });
    expect((await repo.bookReturnAppointment({ orderId: order.id, ...NEW })).created).toBe(false);
    await expect(repo.bookReturnAppointment({ orderId: order.id, ...OLDWINDOW() })).rejects.toThrow(ReturnAlreadyBookedError);

    // Today's Schedule reads SCHEDULED Appointments of any kind.
    expect((await repo.listAppointmentsBetween(new Date("2026-10-04T00:00:00Z"), new Date("2026-10-05T00:00:00Z"))).map((a) => a.kind)).toEqual(["RETURN"]);

    await prisma.appointment.update({ where: { id: first.appointment.id }, data: { status: "CANCELLED" } });
    const revived = await repo.bookReturnAppointment({ orderId: order.id, ...OLDWINDOW() });
    expect(revived).toMatchObject({ created: true, appointment: { id: first.appointment.id, status: "SCHEDULED" } });
    expect(await prisma.appointment.count({ where: { orderId: order.id, kind: "RETURN" } })).toBe(1);

    await prisma.appointment.update({ where: { id: first.appointment.id }, data: { status: "COMPLETED" } });
    await expect(repo.bookReturnAppointment({ orderId: order.id, ...OLDWINDOW() })).rejects.toThrow(ReturnAlreadyBookedError);
    await expect(repo.bookReturnAppointment({ orderId: "nope", ...NEW })).rejects.toThrow(OrderNotFoundError);
  });
});

describe("PrismaOrderRepository Order detail reads (integration)", () => {
  it("lists an Order's notes, and only its own, oldest first", async () => {
    const { order } = await repo.create(newOrder());
    const { order: other } = await repo.create(newOrder());
    await prisma.note.create({ data: { accountId: order.accountId, orderId: order.id, body: "Second", createdAt: new Date("2026-10-02T12:00:00Z") } });
    await prisma.note.create({ data: { accountId: order.accountId, orderId: order.id, body: "First", createdAt: new Date("2026-10-01T12:00:00Z") } });
    await prisma.note.create({ data: { accountId: other.accountId, orderId: other.id, body: "Someone else's" } });
    await prisma.note.create({ data: { accountId: order.accountId, body: "About the customer, not the Order" } });

    expect((await repo.listOrderNotes(order.id)).map((note) => note.body)).toEqual(["First", "Second"]);
  });

  it("lists the status changes on an Order's Items, oldest first", async () => {
    const { order } = await repo.create(newOrder());
    const itemId = order.items[0]!.id;
    await repo.transitionItemStatus({
      itemId,
      toStatus: "UNDER_REVIEW",
      entry: { action: "STATUS_TRANSITION", fromStatus: "REQUEST_SUBMITTED", toStatus: "UNDER_REVIEW", actorAccountId: null, idempotencyKey: null },
    });
    const { order: other } = await repo.create(newOrder());
    await repo.transitionItemStatus({
      itemId: other.items[0]!.id,
      toStatus: "CANCELLED",
      entry: { action: "STATUS_TRANSITION", fromStatus: "REQUEST_SUBMITTED", toStatus: "CANCELLED", actorAccountId: null, idempotencyKey: null },
    });

    expect(await repo.listStatusChanges(order.id)).toEqual([{ itemId, toStatus: "UNDER_REVIEW", at: expect.any(Date) }]);
  });
});

describe("PrismaOrderRepository Needs Attention lists (integration)", () => {
  const cancelItem = (itemId: string) =>
    repo.transitionItemStatus({
      itemId,
      toStatus: "CANCELLED",
      entry: { action: "CANCELLED", fromStatus: "REQUEST_SUBMITTED", toStatus: "CANCELLED", actorAccountId: null, idempotencyKey: null },
    });

  it("lists the PENDING Deposits oldest first: exactly the Orders the summary counts", async () => {
    const newer = (await repo.create(newOrder({ contactName: "Newer", deposit: Money.fromCents(2500), depositPayment: { method: "CASH", amount: Money.fromCents(2500) } }))).order;
    const older = (await repo.create(newOrder({ contactName: "Older" }))).order;
    const paid = (await repo.create(newOrder())).order;
    await prisma.payment.updateMany({ where: { orderId: paid.id }, data: { status: "RECEIVED", receivedAt: new Date() } });
    const cancelled = (await repo.create(newOrder())).order;
    await cancelItem(cancelled.items[0]!.id);
    await prisma.order.update({ where: { id: newer.id }, data: { createdAt: new Date("2026-09-29T12:00:00Z") } });
    await prisma.order.update({ where: { id: older.id }, data: { createdAt: new Date("2026-09-28T12:00:00Z") } });

    const rows = await repo.listAwaitingDeposit();

    expect(rows.map((row) => row.orderId)).toEqual([older.id, newer.id]);
    expect(rows[1]).toMatchObject({ number: newer.number, contactName: "Newer", deposit: { method: "CASH", amount: Money.fromCents(2500) } });
    expect(rows.length).toBe((await repo.summarizeAwaitingDeposit()).orders);
  });

  it("lists Orders with an Item in the given statuses, oldest first", async () => {
    const ready = (await repo.create(newOrder({ items: [newItem(), newItem()] }))).order;
    await prisma.item.update({ where: { id: ready.items[0]!.id }, data: { status: "READY_FOR_PICKUP_SHIPPING" } });
    await repo.create(newOrder());

    const orders = await repo.listWithItemsIn(["READY_FOR_PICKUP_SHIPPING"]);

    expect(orders.map((order) => order.id)).toEqual([ready.id]);
    expect(orders[0]!.items).toHaveLength(2);
  });

  it("confirms a Deposit once: the Payment is RECEIVED and each live Item is audited, with no status change", async () => {
    const { order } = await repo.create(newOrder({ items: [newItem(), newItem(), newItem()] }));
    await cancelItem(order.items[2]!.id);
    const confirm = (key: string) => repo.confirmDeposit({ orderId: order.id, actorAccountId: null, idempotencyKey: key });

    expect(await confirm("k1")).toBe(true);
    expect(await confirm("k1")).toBe(false); // a retry, not an error

    const deposit = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id, kind: "DEPOSIT" } });
    expect(deposit).toMatchObject({ status: "RECEIVED", idempotencyKey: "k1" });
    expect(deposit.receivedAt).toBeInstanceOf(Date);
    const audits = await prisma.itemAuditEntry.findMany({ where: { action: "MANUAL_PAYMENT_CONFIRMED", item: { orderId: order.id } } });
    expect(audits.map((entry) => entry.itemId).sort()).toEqual([order.items[0]!.id, order.items[1]!.id].sort());
    expect(audits[0]).toMatchObject({ fromStatus: "REQUEST_SUBMITTED", toStatus: "REQUEST_SUBMITTED", idempotencyKey: "k1" });
    expect((await prisma.item.findMany({ where: { orderId: order.id }, orderBy: { position: "asc" } })).map((item) => item.status)).toEqual([
      "REQUEST_SUBMITTED",
      "REQUEST_SUBMITTED",
      "CANCELLED",
    ]);
    expect(await repo.listAwaitingDeposit()).toEqual([]);
    // The Order detail timeline reads status changes: the confirmation isn't one.
    expect((await repo.listStatusChanges(order.id)).map((change) => change.toStatus)).toEqual(["CANCELLED"]);
  });

  it("sets the price with the Quote Sent transition in one step, audits it, and is idempotent", async () => {
    const { order } = await repo.create(newOrder());
    const itemId = order.items[0]!.id;
    await prisma.item.update({ where: { id: itemId }, data: { status: "UNDER_REVIEW" } });
    const send = (key: string, cents: number) =>
      repo.transitionItemStatus({
        itemId,
        toStatus: "QUOTE_SENT",
        price: Money.fromCents(cents),
        entry: { action: "QUOTE_SENT", fromStatus: "UNDER_REVIEW", toStatus: "QUOTE_SENT", actorAccountId: null, idempotencyKey: key, metadata: { priceCents: cents } },
      });

    const sent = await send("q1", 9050);
    expect(sent).toMatchObject({ status: "QUOTE_SENT", price: Money.fromCents(9050) });
    expect(await send("q1", 1)).toBeNull(); // a replay changes nothing
    const row = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
    expect(row).toMatchObject({ status: "QUOTE_SENT", priceCents: 9050 });
    const audit = await prisma.itemAuditEntry.findFirstOrThrow({ where: { itemId, action: "QUOTE_SENT" } });
    expect(audit.metadata).toEqual({ priceCents: 9050 });

    // No longer Under Review: refused, and the price stays.
    await expect(send("q2", 5000)).rejects.toThrow(ItemStatusChangedError);
    expect((await prisma.item.findUniqueOrThrow({ where: { id: itemId } })).priceCents).toBe(9050);
  });

  it("finds the Order that holds an Item", async () => {
    const { order } = await repo.create(newOrder({ items: [newItem(), newItem()] }));
    expect((await repo.findByItemId(order.items[1]!.id))?.id).toBe(order.id);
    expect(await repo.findByItemId("nope")).toBeNull();
  });

  it("refuses a second confirmation with a new key, and a fully cancelled Order, having written nothing", async () => {
    const { order } = await repo.create(newOrder());
    await repo.confirmDeposit({ orderId: order.id, actorAccountId: null, idempotencyKey: "k1" });
    await expect(repo.confirmDeposit({ orderId: order.id, actorAccountId: null, idempotencyKey: "k2" })).rejects.toThrow(NoPendingDepositError);

    const gone = (await repo.create(newOrder())).order;
    await cancelItem(gone.items[0]!.id);
    await expect(repo.confirmDeposit({ orderId: gone.id, actorAccountId: null, idempotencyKey: "k3" })).rejects.toThrow(NoPendingDepositError);
    expect((await prisma.payment.findFirstOrThrow({ where: { orderId: gone.id } })).status).toBe("PENDING");
    expect(await prisma.itemAuditEntry.count({ where: { idempotencyKey: { in: ["k2", "k3"] } } })).toBe(0);
  });

  describe("Edit Order and notes", () => {
    const details = (order: { items: { id: string }[] }, overrides: Record<string, unknown> = {}) => ({
      contact: { name: "Sam Lee", email: "sam@example.com", phone: "2125550199" },
      address: { line1: "9 Oak Ave", line2: null, city: "Newark", state: "NJ", zip: "07102" },
      pairs: order.items.map((item, i) => ({
        itemId: item.id,
        brand: "Nike",
        model: null,
        size: i === 0 ? "10" : null,
        colorway: null,
        material: null,
        condition: i === 0 ? "Good" : null,
        description: null,
      })),
      ...overrides,
    });
    const edit = (order: { id: string; updatedAt: Date; items: { id: string }[] }, key = "k1", overrides?: Record<string, unknown>) =>
      repo.updateOrderDetails({ orderId: order.id, expectedUpdatedAt: order.updatedAt, details: details(order, overrides), actorAccountId: null, idempotencyKey: key });

    it("saves contact, address and pairs in one go, audits them, and bumps updatedAt", async () => {
      const { order } = await repo.create(newOrder({ items: [newItem(), newItem()] }));
      expect(await edit(order)).toBe("updated");

      const saved = (await repo.findById(order.id))!;
      expect(saved).toMatchObject({ contactName: "Sam Lee", contactEmail: "sam@example.com", contactPhone: "2125550199" });
      expect(saved.fulfillment).toMatchObject({ method: "PICKUP", date: "2026-10-03", address: { line1: "9 Oak Ave", line2: null, city: "Newark", state: "NJ", zip: "07102" } });
      expect(saved.items.map((item) => [item.brand, item.size, item.condition])).toEqual([
        ["Nike", "10", "Good"],
        ["Nike", null, null],
      ]);
      expect(saved.updatedAt.getTime()).toBeGreaterThan(order.updatedAt.getTime());

      const audits = await prisma.itemAuditEntry.findMany({ where: { item: { orderId: order.id } } });
      expect(audits.map((entry) => [entry.action, entry.itemId, entry.idempotencyKey]).sort()).toEqual(
        [
          ["DETAILS_EDITED", order.items[0]!.id, "k1"],
          ["DETAILS_EDITED", order.items[1]!.id, "k1"],
          ["ORDER_CONTACT_EDITED", order.items[0]!.id, "k1:contact"],
        ].sort(),
      );
      const contact = audits.find((entry) => entry.action === "ORDER_CONTACT_EDITED")!;
      expect(contact.metadata).toEqual({ fields: ["contactName", "contactEmail", "contactPhone", "address.line1", "address.line2", "address.city", "address.state", "address.zip"] });
      expect(contact).toMatchObject({ fromStatus: null, toStatus: null });
      // Not a status change, so the timeline doesn't see it.
      expect(await repo.listStatusChanges(order.id)).toEqual([]);
    });

    it("refuses a stale form, treats a retry as applied, and writes nothing for no change", async () => {
      const { order } = await repo.create(newOrder());
      expect(await edit(order, "k1")).toBe("updated");
      await expect(edit(order, "k2", { contact: { name: "Other", email: "o@example.com", phone: "2125550100" } })).rejects.toThrow(OrderChangedError);
      expect((await repo.findById(order.id))!.contactName).toBe("Sam Lee");
      expect(await edit(order, "k1")).toBe("already-applied");

      const current = (await repo.findById(order.id))!;
      expect(await edit(current, "k3")).toBe("unchanged");
      expect((await repo.findById(order.id))!.updatedAt).toEqual(current.updatedAt);
    });

    it("refuses a pair from another Order, and an unknown Order, having written nothing", async () => {
      const { order } = await repo.create(newOrder());
      const other = (await repo.create(newOrder())).order;
      await expect(edit(order, "k1", { pairs: [{ ...details(order).pairs[0]!, itemId: other.items[0]!.id }] })).rejects.toThrow(ItemNotFoundError);
      expect((await repo.findById(order.id))!.contactName).toBe("Jordan Smith");
      await expect(repo.updateOrderDetails({ orderId: "nope", expectedUpdatedAt: new Date(), details: details(order), actorAccountId: null, idempotencyKey: "k" })).rejects.toThrow(OrderNotFoundError);
    });

    it("adds a note under the Order's Account, newest last in listOrderNotes", async () => {
      const { order } = await repo.create(newOrder());
      const admin = await prisma.account.create({ data: { role: "ADMIN", email: `admin${++counter}-${Date.now()}@example.com` } });
      const note = await repo.addOrderNote({ orderId: order.id, authorAccountId: admin.id, body: "Call first." });
      expect(note).toMatchObject({ body: "Call first." });
      await repo.addOrderNote({ orderId: order.id, authorAccountId: admin.id, body: "Second." });

      const row = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
      expect(row).toMatchObject({ accountId: order.accountId, orderId: order.id, authorAccountId: admin.id });
      expect((await repo.listOrderNotes(order.id)).map((n) => n.body)).toEqual(["Call first.", "Second."]);
      await expect(repo.addOrderNote({ orderId: "nope", authorAccountId: null, body: "x" })).rejects.toThrow(OrderNotFoundError);
    });
  });
});
