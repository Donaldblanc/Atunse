"use client";

import { useActionState, useState } from "react";
import { REVIEW_REPLY_MAX_LENGTH } from "@/features/reviews/use-cases/review-use-cases";
import { replyToReviewAction, type ReplyState } from "./review-actions";
import "@/styles/overview-stock-reviews.css";

/** A review's Reply: a textarea and a button. The reply isn't emailed to the customer. */
export function ReviewReplyForm({ reviewId, existing, idempotencyKey }: { reviewId: string; existing: string | null; idempotencyKey: string }) {
  const [reply, setReply] = useState(existing ?? "");
  const [state, formAction, pending] = useActionState<ReplyState, FormData>(async (previous, formData) => replyToReviewAction(previous, formData), { error: null, done: 0 });

  return (
    <form action={formAction} className="rev-reply-form">
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label className="stk-label" htmlFor={`rev-reply-${reviewId}`}>
        {existing ? "Edit reply" : "Reply"}
      </label>
      <textarea
        id={`rev-reply-${reviewId}`}
        name="reply"
        rows={2}
        value={reply}
        onChange={(event) => setReply(event.target.value)}
        maxLength={REVIEW_REPLY_MAX_LENGTH}
        placeholder="Your reply shows under the review. It isn't emailed."
        className="oe-input"
      />
      <button type="submit" className="admin-btn" data-variant="secondary" disabled={pending || reply.trim() === ""}>
        {pending ? "Saving…" : existing ? "Update reply" : "Reply"}
      </button>
      {state.error && (
        <p role="alert" className="od-status-error">
          {state.error}
        </p>
      )}
      {state.done > 0 && !state.error && <p className="ov-cell-sub">Reply saved.</p>}
    </form>
  );
}
