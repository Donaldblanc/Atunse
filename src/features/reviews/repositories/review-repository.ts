// The ReviewRepository seam (ADR-0003/0011): customer Reviews and the
// owner's moderation of them. Only the Prisma implementation imports Prisma.

export const REVIEW_STATUSES = ["PENDING", "PUBLISHED", "HIDDEN"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface AdminReview {
  id: string;
  /** The Account's name, or null when it has none. */
  reviewerName: string | null;
  rating: number;
  body: string;
  status: ReviewStatus;
  createdAt: Date;
  publishedAt: Date | null;
  reply: string | null;
  repliedAt: Date | null;
}

export class ReviewNotFoundError extends Error {
  constructor() {
    super("Review not found");
    this.name = "ReviewNotFoundError";
  }
}

export interface ReviewRepository {
  /** PUBLISHED reviews, newest published first. */
  listLatestPublished(limit: number): Promise<AdminReview[]>;
  /** Reviews in one status, newest first. */
  listByStatus(status: ReviewStatus, limit: number): Promise<AdminReview[]>;
  countsByStatus(): Promise<Record<ReviewStatus, number>>;
  /**
   * Publish sets `publishedAt` (kept if the review is already PUBLISHED, so a
   * repeat changes nothing); Hide sets HIDDEN. @throws ReviewNotFoundError
   */
  setStatus(reviewId: string, status: "PUBLISHED" | "HIDDEN", at: Date): Promise<void>;
  /** Stores the shop's public reply with its time and author. Not emailed. @throws ReviewNotFoundError */
  setReply(reviewId: string, reply: string, authorAccountId: string | null, at: Date): Promise<void>;
}
