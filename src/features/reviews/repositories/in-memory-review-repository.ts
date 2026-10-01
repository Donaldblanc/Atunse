// Test double for the ReviewRepository seam (see the Prisma version).

import { REVIEW_STATUSES, ReviewNotFoundError, type AdminReview, type ReviewRepository, type ReviewStatus } from "./review-repository";

export interface InMemoryReview extends AdminReview {
  repliedByAccountId?: string | null;
}

export class InMemoryReviewRepository implements ReviewRepository {
  constructor(readonly reviews: InMemoryReview[] = []) {}

  private find(id: string): InMemoryReview {
    const review = this.reviews.find((candidate) => candidate.id === id);
    if (!review) throw new ReviewNotFoundError();
    return review;
  }

  async listLatestPublished(limit: number): Promise<AdminReview[]> {
    return this.reviews
      .filter((review) => review.status === "PUBLISHED")
      .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0) || b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async listByStatus(status: ReviewStatus, limit: number): Promise<AdminReview[]> {
    return this.reviews
      .filter((review) => review.status === status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async countsByStatus(): Promise<Record<ReviewStatus, number>> {
    return Object.fromEntries(REVIEW_STATUSES.map((status) => [status, this.reviews.filter((review) => review.status === status).length])) as Record<ReviewStatus, number>;
  }

  async setStatus(reviewId: string, status: "PUBLISHED" | "HIDDEN", at: Date): Promise<void> {
    const review = this.find(reviewId);
    if (review.status === status) return;
    review.status = status;
    if (status === "PUBLISHED") review.publishedAt = at;
  }

  // Last write wins by design: one owner, and the form is labelled "Edit reply".
  async setReply(reviewId: string, reply: string, authorAccountId: string | null, at: Date): Promise<void> {
    const review = this.find(reviewId);
    review.reply = reply;
    review.repliedAt = at;
    review.repliedByAccountId = authorAccountId;
  }
}
