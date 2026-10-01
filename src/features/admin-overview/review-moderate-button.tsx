"use client";

import { useActionState } from "react";
import { moderateReviewAction, type ModerateState } from "./review-actions";
import "@/styles/overview-stock-reviews.css";

/** A review's Publish or Hide button; a refusal (e.g. the review was deleted) shows under it. */
export function ReviewModerateButton({ reviewId, status, label, idempotencyKey }: { reviewId: string; status: "PUBLISHED" | "HIDDEN"; label: string; idempotencyKey: string }) {
  const [state, formAction, pending] = useActionState<ModerateState, FormData>(moderateReviewAction, { error: null });
  return (
    <form action={formAction}>
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <button type="submit" className="admin-btn" data-variant={status === "HIDDEN" ? "secondary" : undefined} disabled={pending}>
        {label}
      </button>
      {state.error && (
        <p role="alert" className="od-status-error">
          {state.error}
        </p>
      )}
    </form>
  );
}
