// Proves the repository seam against a REAL Postgres — not mocked — per
// Phase 0's "repository and migration integration tests" requirement.
// Requires DATABASE_URL (see .env.example); run with `npm run test:integration`.

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Money } from "@/shared/money/money";
import { EmailTakenError, PhotoKeyInUseError, type NewOrderInput } from "./order-repository";
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
/** Unique photo keys per call: item_photos.key is unique across all Items. */
function photoKeys(n = 1) {
  counter += 1;
  return Array.from({ length: n }, (_, i) => `bookings/run-${counter}/${i}.jpg`);
}

afterAll(async () => {
  await prisma.$disconnect();
});

function newOrder(overrides: Partial<NewOrderInput> = {}): NewOrderInput {
  return {
    owner: newCustomer(),
    contactName: "Jordan Smith",
    contactEmail: "customer@example.com",
    contactPhone: "2125550142",
    policyAcceptedAt: new Date(),
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
    item: {
      brand: null,
      model: null,
      description: null,
      material: null,
      serviceIds: ["standard"],
      estimate: Money.fromCents(3000),
      photoKeys: photoKeys(),
    },
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
        item: {
          brand: "Nike Air Max",
          model: null,
          description: "scuffed",
          material: "Suede",
          serviceIds: ["standard"],
          estimate: Money.fromCents(4000),
          photoKeys: ["k1", "k2"],
        },
      }),
    );

    expect(created).toBe(true);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]?.status).toBe("REQUEST_SUBMITTED");
    expect(order.items[0]?.price).toBeNull();

    const reloaded = await repo.findById(order.id);
    expect(reloaded?.items[0]?.photoKeys).toEqual(["k1", "k2"]);
    expect(reloaded?.items[0]?.serviceIds).toEqual(["standard"]);
    expect(reloaded?.items[0]?.material).toBe("Suede");
    expect(reloaded?.items[0]?.estimate.cents).toBe(4000);
    expect(reloaded?.contactName).toBe("Jordan Smith");
    expect(reloaded?.rush).toBe(true);
    expect(reloaded?.estimate.cents).toBe(5000);
    expect(reloaded?.deposit.cents).toBe(2500);
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

  it("books into an existing Account by id", async () => {
    const first = await repo.create(newOrder());
    const second = await repo.create(newOrder({ owner: { accountId: first.order.accountId } }));
    expect(second.order.accountId).toBe(first.order.accountId);
  });

  it("stores photos in order and round-trips them", async () => {
    const keys = photoKeys(3);
    const { order } = await repo.create(newOrder({ item: { ...newOrder().item, photoKeys: keys } }));
    expect((await repo.findById(order.id))?.items[0]?.photoKeys).toEqual(keys);
  });

  it("lets exactly one of two concurrent bookings claim a photo key (20 runs)", async () => {
    for (let run = 0; run < 20; run++) {
      const shared = photoKeys();
      const results = await Promise.allSettled([
        repo.create(newOrder({ item: { ...newOrder().item, photoKeys: shared } })),
        repo.create(newOrder({ item: { ...newOrder().item, photoKeys: shared } })),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(PhotoKeyInUseError);
      expect(await prisma.itemPhoto.count({ where: { key: shared[0] } })).toBe(1);
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
