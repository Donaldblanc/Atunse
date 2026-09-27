// The limit must hold in Postgres under concurrency, not just in memory.
// Run with `npm run test:integration` (against a throwaway database).

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaRateLimiter } from "./prisma-rate-limiter";

const prisma = new PrismaClient();
const policy = { name: "it", limit: 5, windowSeconds: 600 };

beforeEach(async () => {
  await prisma.rateLimitBucket.deleteMany();
});

afterAll(async () => {
  await prisma.rateLimitBucket.deleteMany();
  await prisma.$disconnect();
});

describe("PrismaRateLimiter (integration)", () => {
  it("allows exactly the limit when 20 requests arrive at once", async () => {
    const limiter = new PrismaRateLimiter(prisma, () => 1);
    const now = new Date();
    const results = await Promise.all(Array.from({ length: 20 }, () => limiter.consume(policy, "burst", now)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it("prunes windows older than a day", async () => {
    await prisma.rateLimitBucket.create({ data: { key: "it:old", windowStart: new Date("2020-01-01T00:00:00Z"), count: 3 } });
    await new PrismaRateLimiter(prisma, () => 0).consume(policy, "pruner");
    expect(await prisma.rateLimitBucket.count({ where: { key: "it:old" } })).toBe(0);
  });
});
