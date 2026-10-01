import { REVIEW_STATUSES, type ReviewStatus } from "@/features/reviews/repositories/review-repository";

/** The Reviews dialog's tab, from `?reviewTab=`. Anything else falls back to PENDING (the ones awaiting a decision). */
export function parseReviewTab(value: string | string[] | undefined): ReviewStatus {
  return REVIEW_STATUSES.find((status) => status.toLowerCase() === value) ?? "PENDING";
}
