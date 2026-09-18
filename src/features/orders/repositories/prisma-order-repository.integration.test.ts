// Proves the repository seam against a REAL Postgres — not mocked — per
// Phase 0's "repository and migration integration tests" requirement.
// Requires DATABASE_URL (see .env.example); run with `npm run test:integration`.

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaOrderRepository } from "./prisma-order-repository";

const prisma = new PrismaClient();
const repo = new PrismaOrderRepository(prisma);

beforeEach(async () => {
  await prisma.itemAuditEntry.deleteMany();
  await prisma.item.deleteMany();
  await prisma.order.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("PrismaOrderRepository (integration)", () => {
  it("persists a new order with its item and round-trips domain types", async () => {
    const order = await repo.create({
      accountId: null,
      guestEmail: "customer@example.com",
      guestPhone: null,
      policyAcceptedAt: new Date(),
      item: { brand: "Nike", model: "Air Max", description: "scuffed", photoKeys: ["k1", "k2"] },
    });

    expect(order.items).toHaveLength(1);
    expect(order.items[0]?.status).toBe("REQUEST_SUBMITTED");
    expect(order.items[0]?.price).toBeNull();

    const reloaded = await repo.findById(order.id);
    expect(reloaded?.items[0]?.photoKeys).toEqual(["k1", "k2"]);
  });

  it("transitions an item's status and writes one audit entry, transactionally", async () => {
    const order = await repo.create({
      accountId: null,
      guestEmail: "customer@example.com",
      guestPhone: null,
      policyAcceptedAt: new Date(),
      item: { brand: null, model: null, description: null, photoKeys: [] },
    });
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
    const order = await repo.create({
      accountId: null,
      guestEmail: "customer@example.com",
      guestPhone: null,
      policyAcceptedAt: new Date(),
      item: { brand: null, model: null, description: null, photoKeys: [] },
    });
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
