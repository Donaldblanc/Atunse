"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { requireRole } from "@/features/accounts/authz";
import { buildReviewDeps } from "@/features/reviews/deps";
import { moderateReview, replyToReview } from "@/features/reviews/use-cases/review-use-cases";

export type ReplyState = { error: string | null; /** Bumped on each success so the form can clear itself. */ done: number };

export type ModerateState = { error: string | null };

const text =(formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

// A database id (cuid): the only shape the review field may take.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Publish or Hide on a review. Setting a status twice changes nothing, so
 * a replay is harmless. The role is checked first (ADR-0012); a missing
 * review comes back as a message for the form.
 */
export async function moderateReviewAction(_previous: ModerateState, formData: FormData): Promise<ModerateState> {
  const actingUser = await actingUserFromCookies(await cookies());
  requireRole(actingUser, "ADMIN");

  const reviewId = text(formData, "reviewId");
  const status = text(formData, "status");
  if (!ID_PATTERN.test(reviewId) || !text(formData, "idempotencyKey") || (status !== "PUBLISHED" && status !== "HIDDEN")) {
    return { error: "That request wasn't valid. Reload and try again." };
  }

  const result = await moderateReview(buildReviewDeps(), actingUser, { reviewId, status });
  revalidatePath("/admin");
  return { error: result.ok ? null : result.error };
}

/** A reply to a review: stored with its time and author, shown publicly later, never emailed. */
export async function replyToReviewAction(previous: ReplyState, formData: FormData): Promise<ReplyState> {
  const actingUser = await actingUserFromCookies(await cookies());
  requireRole(actingUser, "ADMIN");

  const reviewId = text(formData, "reviewId");
  if (!ID_PATTERN.test(reviewId) || !text(formData, "idempotencyKey")) return { ...previous, error: "That request wasn't valid. Reload and try again." };

  const result = await replyToReview(buildReviewDeps(), actingUser, { reviewId, reply: text(formData, "reply") });
  if (!result.ok) return { ...previous, error: result.error };

  revalidatePath("/admin");
  return { error: null, done: previous.done + 1 };
}
