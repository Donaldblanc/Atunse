import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InMemoryReviewRepository, type InMemoryReview } from "@/features/reviews/repositories/in-memory-review-repository";

const admin = { accountId: "admin-1", role: "ADMIN" as const };
const NOW = new Date("2026-10-01T12:00:00Z");

const review = (id: string, status: InMemoryReview["status"], day: number): InMemoryReview => ({
  id,
  reviewerName: "Ada",
  rating: 5,
  body: "Great work",
  status,
  createdAt: new Date(Date.UTC(2026, 8, day)),
  publishedAt: status === "PUBLISHED" ? new Date(Date.UTC(2026, 8, day)) : null,
  reply: null,
  repliedAt: null,
});

let repo: InMemoryReviewRepository;

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/features/accounts/acting-user", () => ({ actingUserFromCookies: async () => admin }));
vi.mock("@/features/reviews/deps", () => ({ buildReviewDeps: () => ({ reviews: repo, now: () => NOW }) }));

const { default: AdminReviewsPage } = await import("./page");

describe("admin reviews page (full-list version of the Overview's Reviews panel, #130)", () => {
  it("shows the PENDING tab (the default) with its count and reviews", async () => {
    repo = new InMemoryReviewRepository([review("p1", "PUBLISHED", 1), review("n1", "PENDING", 3), review("h1", "HIDDEN", 2)]);
    const page = await AdminReviewsPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Pending (1)");
    expect(html).toContain("Published (1)");
    expect(html).toContain("Hidden (1)");
    expect(html).toContain("Great work");
    expect(html).toContain(">Publish</button>");
  });

  it("reads the ?tab= param", async () => {
    repo = new InMemoryReviewRepository([review("p1", "PUBLISHED", 1)]);
    const page = await AdminReviewsPage({ searchParams: Promise.resolve({ tab: "published" }) });
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Great work");
  });

  it("shows an empty state when a tab has no reviews", async () => {
    repo = new InMemoryReviewRepository([]);
    const page = await AdminReviewsPage({ searchParams: Promise.resolve({ tab: "hidden" }) });
    const html = renderToStaticMarkup(page);
    expect(html).toContain("No hidden reviews.");
  });
});
