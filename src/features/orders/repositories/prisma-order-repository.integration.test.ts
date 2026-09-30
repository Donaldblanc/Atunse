// Proves the repository seam against a REAL Postgres — not mocked — per
// Phase 0's "repository and migration integration tests" requirement.
// Requires DATABASE_URL (see .env.example); run with `npm run test:integration`.

import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Money } from "@/shared/money/money";
import {
  EmailTakenError,
  ItemNotFoundError,
  ItemStatusChangedError,
  PhotoKeyInUseError,
  type NewItemInput,
  type NewOrderInput,
} from "./order-repository";
import { PrismaOrderRepository } from "./prisma-order-repository";

const prisma = new PrismaClient();
const repo = new PrismaOrderRepository(prisma);

beforeEach(async () => {
  await prisma.itemAuditEntry.deleteMany();
  await prisma.itemPhoto.deleteMany();
  await prisma.item.deleteMany();
  await prisma.order.deleteMany();
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
      await prisma.itemPhoto.deleteMany();
      await prisma.item.deleteMany();
      await prisma.order.deleteMany();
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

  it("finds the Local Drop-Off collections booked on a day", async () => {
    const today = (await repo.create(newOrder())).order; // collected 2026-10-03
    await repo.create(
      newOrder({ fulfillment: { method: "PICKUP", address: { line1: "1 Main St", line2: null, city: "New York", state: "NY", zip: "10001" }, date: "2026-10-04", slot: "4:30 PM – 5:00 PM" } }),
    );
    await repo.create(
      newOrder({ fulfillment: { method: "MAIL_IN", address: { line1: "1 Main St", line2: null, city: "Austin", state: "TX", zip: "73301" }, preferredDate: "2026-10-03" } }),
    );

    expect((await repo.listCollectionsOn("2026-10-03")).map((order) => order.id)).toEqual([today.id]);
  });

  it("finds which Orders have a payment confirmed", async () => {
    const paid = (await repo.create(newOrder({ items: [newItem(), newItem()] }))).order;
    const unpaid = (await repo.create(newOrder())).order;
    await transition(paid.items[1]!.id, "MANUAL_PAYMENT_CONFIRMED", "REQUEST_SUBMITTED", "UNDER_REVIEW");

    expect(await repo.findPaidOrderIds([paid.id, unpaid.id])).toEqual(new Set([paid.id]));
  });

  it("counts Items by status", async () => {
    const { order } = await repo.create(newOrder({ items: [newItem(), newItem(), newItem()] }));
    await transition(order.items[0]!.id, "REVIEW_STARTED", "REQUEST_SUBMITTED", "UNDER_REVIEW");

    expect(await repo.countItemsByStatus()).toEqual({ REQUEST_SUBMITTED: 2, UNDER_REVIEW: 1 });
  });

  it("sums the Deposits of Orders with no payment confirmed, skipping fully cancelled Orders", async () => {
    await repo.create(newOrder({ deposit: Money.fromCents(1500) }));
    await repo.create(newOrder({ deposit: Money.fromCents(2500) }));
    const paid = (await repo.create(newOrder({ deposit: Money.fromCents(4000) }))).order;
    await transition(paid.items[0]!.id, "MANUAL_PAYMENT_CONFIRMED", "REQUEST_SUBMITTED", "UNDER_REVIEW");
    const cancelled = (await repo.create(newOrder({ deposit: Money.fromCents(8000) }))).order;
    await transition(cancelled.items[0]!.id, "CANCELLED", "REQUEST_SUBMITTED", "CANCELLED");

    const summary = await repo.summarizeAwaitingDeposit();

    expect(summary.orders).toBe(2);
    expect(summary.deposits.cents).toBe(4000);
  });
});
