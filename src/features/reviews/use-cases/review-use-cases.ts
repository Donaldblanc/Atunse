import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { ReviewNotFoundError, type AdminReview, type ReviewRepository, type ReviewStatus } from "../repositories/review-repository";

export const LATEST_REVIEWS_LIMIT = 3;
export const REVIEW_LIST_LIMIT = 100;
export const REVIEW_REPLY_MAX_LENGTH = 2000;

/** The Overview's Recent Reviews: the latest PUBLISHED ones. Admin-only (ADR-0012). */
export async function getLatestReviews(deps: { reviews: Pick<ReviewRepository, "listLatestPublished"> }, actingUser: ActingUser): Promise<AdminReview[]> {
  requireRole(actingUser, "ADMIN");
  return deps.reviews.listLatestPublished(LATEST_REVIEWS_LIMIT);
}

/** The `?reviews=all` dialog: one status's reviews and the tab counts. Admin-only. */
export async function getReviewsByStatus(
  deps: { reviews: Pick<ReviewRepository, "listByStatus" | "countsByStatus"> },
  actingUser: ActingUser,
  status: ReviewStatus,
): Promise<{ reviews: AdminReview[]; counts: Record<ReviewStatus, number> }> {
  requireRole(actingUser, "ADMIN");
  const [reviews, counts] = await Promise.all([deps.reviews.listByStatus(status, REVIEW_LIST_LIMIT), deps.reviews.countsByStatus()]);
  return { reviews, counts };
}

export type ReviewActionResult = { ok: true } | { ok: false; error: string };

const NOT_FOUND: ReviewActionResult = { ok: false, error: "This review no longer exists." };

/** Publish or Hide. A repeat changes nothing, so a replay is harmless. Admin-only. */
export async function moderateReview(
  deps: { reviews: Pick<ReviewRepository, "setStatus">; now: () => Date },
  actingUser: ActingUser,
  input: { reviewId: string; status: "PUBLISHED" | "HIDDEN" },
): Promise<ReviewActionResult> {
  requireRole(actingUser, "ADMIN");
  try {
    await deps.reviews.setStatus(input.reviewId, input.status, deps.now());
    return { ok: true };
  } catch (err) {
    if (err instanceof ReviewNotFoundError) return NOT_FOUND;
    throw err;
  }
}

/** The shop's public reply: 1 to 2000 characters, stored with its author and time, never emailed. Admin-only. */
export async function replyToReview(
  deps: { reviews: Pick<ReviewRepository, "setReply">; now: () => Date },
  actingUser: ActingUser,
  input: { reviewId: string; reply: string },
): Promise<ReviewActionResult> {
  requireRole(actingUser, "ADMIN");
  const reply = input.reply.trim();
  if (reply.length === 0) return { ok: false, error: "Write a reply first." };
  if (reply.length > REVIEW_REPLY_MAX_LENGTH) return { ok: false, error: `Keep replies under ${REVIEW_REPLY_MAX_LENGTH} characters.` };
  try {
    await deps.reviews.setReply(input.reviewId, reply, actingUser.accountId, deps.now());
    return { ok: true };
  } catch (err) {
    if (err instanceof ReviewNotFoundError) return NOT_FOUND;
    throw err;
  }
}
