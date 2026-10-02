import type { PrismaClient, Prisma } from "@prisma/client";
import { REVIEW_STATUSES, ReviewNotFoundError, type AdminReview, type ReviewRepository, type ReviewStatus } from "./review-repository";

const SELECT = {
  id: true,
  rating: true,
  body: true,
  status: true,
  createdAt: true,
  publishedAt: true,
  reply: true,
  repliedAt: true,
  account: { select: { name: true } },
} satisfies Prisma.ReviewSelect;

type Row = Prisma.ReviewGetPayload<{ select: typeof SELECT }>;

const toReview = ({ account, ...row }: Row): AdminReview => ({ ...row, reviewerName: account.name });

export class PrismaReviewRepository implements ReviewRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listLatestPublished(limit: number): Promise<AdminReview[]> {
    const rows = await this.prisma.review.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: SELECT,
    });
    return rows.map(toReview);
  }

  async listByStatus(status: ReviewStatus, limit: number): Promise<AdminReview[]> {
    const rows = await this.prisma.review.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: limit, select: SELECT });
    return rows.map(toReview);
  }

  async countsByStatus(): Promise<Record<ReviewStatus, number>> {
    const groups = await this.prisma.review.groupBy({ by: ["status"], _count: { _all: true } });
    const counts = Object.fromEntries(REVIEW_STATUSES.map((status) => [status, 0])) as Record<ReviewStatus, number>;
    for (const group of groups) counts[group.status] = group._count._all;
    return counts;
  }

  async setStatus(reviewId: string, status: "PUBLISHED" | "HIDDEN", at: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const review = await tx.review.findUnique({ where: { id: reviewId }, select: { status: true, publishedAt: true } });
      if (!review) throw new ReviewNotFoundError();
      if (review.status === status) return;
      await tx.review.update({
        where: { id: reviewId },
        data: status === "PUBLISHED" ? { status, publishedAt: at } : { status },
      });
    });
  }

  // Last write wins by design: one owner, and the form is labelled "Edit reply".
  async setReply(reviewId: string, reply: string, authorAccountId: string | null, at: Date): Promise<void> {
    const updated = await this.prisma.review.updateMany({
      where: { id: reviewId },
      data: { reply, repliedAt: at, repliedByAccountId: authorAccountId },
    });
    if (updated.count === 0) throw new ReviewNotFoundError();
  }
}
