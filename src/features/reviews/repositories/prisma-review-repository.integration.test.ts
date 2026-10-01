// Proves the ReviewRepository against a REAL Postgres. Run with `npm run test:integration`.

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaReviewRepository } from "./prisma-review-repository";
import { ReviewNotFoundError } from "./review-repository";

const prisma = new PrismaClient();
const repo = new PrismaReviewRepository(prisma);

const EMAIL = "review-repo-test@example.com";
let accountId: string;

beforeEach(async () => {
  // Only reviews (and the one Account these tests own, kept between tests).
  await prisma.reviewPhoto.deleteMany();
  await prisma.review.deleteMany();
  const account = await prisma.account.findFirst({ where: { email: EMAIL, role: "CUSTOMER" } });
  accountId = account?.id ?? (await prisma.account.create({ data: { email: EMAIL, role: "CUSTOMER", name: "Ada Lovelace" } })).id;
});

afterAll(async () => {
  await prisma.reviewPhoto.deleteMany();
  await prisma.review.deleteMany();
  await prisma.account.deleteMany({ where: { email: EMAIL, role: "CUSTOMER" } });
  await prisma.$disconnect();
});

const make = (status: "PENDING" | "PUBLISHED" | "HIDDEN", publishedAt: Date | null = null) =>
  prisma.review.create({ data: { accountId, rating: 5, body: "Great", status, publishedAt } });

describe("PrismaReviewRepository reading (integration)", () => {
  it("lists the latest PUBLISHED reviews, newest published first, with the reviewer's name", async () => {
    await make("PUBLISHED", new Date("2026-09-01"));
    const newer = await make("PUBLISHED", new Date("2026-09-05"));
    await make("PENDING");
    await make("HIDDEN");
    const latest = await repo.listLatestPublished(5);
    expect(latest).toHaveLength(2);
    expect(latest[0]).toMatchObject({ id: newer.id, reviewerName: "Ada Lovelace", status: "PUBLISHED" });
    expect(await repo.listLatestPublished(1)).toHaveLength(1);
  });

  it("lists by status and counts every status", async () => {
    await make("PENDING");
    await make("PENDING");
    await make("HIDDEN");
    expect(await repo.listByStatus("PENDING", 10)).toHaveLength(2);
    expect(await repo.countsByStatus()).toEqual({ PENDING: 2, PUBLISHED: 0, HIDDEN: 1 });
  });
});

describe("PrismaReviewRepository moderation (integration)", () => {
  it("publishes with the time, and a repeat keeps the first time", async () => {
    const { id } = await make("PENDING");
    await repo.setStatus(id, "PUBLISHED", new Date("2026-10-01"));
    await repo.setStatus(id, "PUBLISHED", new Date("2026-11-01"));
    expect(await prisma.review.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "PUBLISHED", publishedAt: new Date("2026-10-01") });
  });

  it("hides", async () => {
    const { id } = await make("PUBLISHED", new Date("2026-09-01"));
    await repo.setStatus(id, "HIDDEN", new Date());
    expect((await prisma.review.findUniqueOrThrow({ where: { id } })).status).toBe("HIDDEN");
  });

  it("stores a reply with its time and author", async () => {
    const { id } = await make("PUBLISHED", new Date("2026-09-01"));
    await repo.setReply(id, "Thank you!", accountId, new Date("2026-10-02"));
    expect(await prisma.review.findUniqueOrThrow({ where: { id } })).toMatchObject({ reply: "Thank you!", repliedAt: new Date("2026-10-02"), repliedByAccountId: accountId });
  });

  it("refuses an unknown review", async () => {
    await expect(repo.setStatus("nope", "HIDDEN", new Date())).rejects.toBeInstanceOf(ReviewNotFoundError);
    await expect(repo.setReply("nope", "hi", null, new Date())).rejects.toBeInstanceOf(ReviewNotFoundError);
  });
});
