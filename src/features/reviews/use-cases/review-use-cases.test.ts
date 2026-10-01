import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { InMemoryReviewRepository, type InMemoryReview } from "../repositories/in-memory-review-repository";
import { getLatestReviews, getReviewsByStatus, moderateReview, replyToReview } from "./review-use-cases";

const admin = { accountId: "admin-1", role: "ADMIN" as const };
const customer = { accountId: "c-1", role: "CUSTOMER" as const };
const NOW = new Date("2026-10-01T12:00:00Z");

const review = (id: string, status: InMemoryReview["status"], day: number): InMemoryReview => ({
  id,
  reviewerName: "Ada",
  rating: 5,
  body: "Great",
  status,
  createdAt: new Date(Date.UTC(2026, 8, day)),
  publishedAt: status === "PUBLISHED" ? new Date(Date.UTC(2026, 8, day)) : null,
  reply: null,
  repliedAt: null,
});

function setup() {
  const reviews = new InMemoryReviewRepository([review("p1", "PUBLISHED", 1), review("p2", "PUBLISHED", 5), review("n1", "PENDING", 3), review("h1", "HIDDEN", 2)]);
  return { reviews, deps: { reviews, now: () => NOW } };
}

describe("reading reviews", () => {
  it("shows the latest PUBLISHED ones, newest first", async () => {
    const { deps } = setup();
    expect((await getLatestReviews(deps, admin)).map((r) => r.id)).toEqual(["p2", "p1"]);
  });
  it("lists one status with all the tab counts", async () => {
    const { deps } = setup();
    const { reviews, counts } = await getReviewsByStatus(deps, admin, "PENDING");
    expect(reviews.map((r) => r.id)).toEqual(["n1"]);
    expect(counts).toEqual({ PENDING: 1, PUBLISHED: 2, HIDDEN: 1 });
  });
  it("is admin-only", async () => {
    const { deps } = setup();
    await expect(getLatestReviews(deps, customer)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(getReviewsByStatus(deps, customer, "PENDING")).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("moderateReview", () => {
  it("publishes with the time, and a repeat keeps it", async () => {
    const { deps, reviews } = setup();
    expect(await moderateReview(deps, admin, { reviewId: "n1", status: "PUBLISHED" })).toEqual({ ok: true });
    expect(reviews.reviews.find((r) => r.id === "n1")).toMatchObject({ status: "PUBLISHED", publishedAt: NOW });
    await moderateReview({ ...deps, now: () => new Date("2026-11-01") }, admin, { reviewId: "n1", status: "PUBLISHED" });
    expect(reviews.reviews.find((r) => r.id === "n1")?.publishedAt).toEqual(NOW);
  });
  it("hides", async () => {
    const { deps, reviews } = setup();
    await moderateReview(deps, admin, { reviewId: "p1", status: "HIDDEN" });
    expect(reviews.reviews.find((r) => r.id === "p1")?.status).toBe("HIDDEN");
  });
  it("reports a missing review and is admin-only", async () => {
    const { deps } = setup();
    expect(await moderateReview(deps, admin, { reviewId: "zzz", status: "HIDDEN" })).toMatchObject({ ok: false });
    await expect(moderateReview(deps, customer, { reviewId: "p1", status: "HIDDEN" })).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("replyToReview", () => {
  it("stores the trimmed reply with its time and author", async () => {
    const { deps, reviews } = setup();
    expect(await replyToReview(deps, admin, { reviewId: "p1", reply: "  Thank you!  " })).toEqual({ ok: true });
    expect(reviews.reviews.find((r) => r.id === "p1")).toMatchObject({ reply: "Thank you!", repliedAt: NOW, repliedByAccountId: "admin-1" });
  });
  it("replaces an earlier reply (last write wins) with the second writer's time and author", async () => {
    const { deps, reviews } = setup();
    await replyToReview(deps, admin, { reviewId: "p1", reply: "First" });
    const later = new Date("2026-10-02T09:00:00Z");
    await replyToReview({ ...deps, now: () => later }, { accountId: "admin-2", role: "ADMIN" }, { reviewId: "p1", reply: "Second" });
    expect(reviews.reviews.find((r) => r.id === "p1")).toMatchObject({ reply: "Second", repliedAt: later, repliedByAccountId: "admin-2" });
  });
  it("rejects empty and over-long replies", async () => {
    const { deps } = setup();
    expect(await replyToReview(deps, admin, { reviewId: "p1", reply: "  " })).toMatchObject({ ok: false });
    expect(await replyToReview(deps, admin, { reviewId: "p1", reply: "x".repeat(2001) })).toMatchObject({ ok: false });
  });
  it("reports a missing review and is admin-only", async () => {
    const { deps } = setup();
    expect(await replyToReview(deps, admin, { reviewId: "zzz", reply: "hi" })).toMatchObject({ ok: false });
    await expect(replyToReview(deps, customer, { reviewId: "p1", reply: "hi" })).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
