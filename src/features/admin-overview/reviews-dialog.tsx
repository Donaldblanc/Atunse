import { randomUUID } from "node:crypto";
import Link from "next/link";
import { StarIcon } from "@phosphor-icons/react/dist/ssr";
import { SHOP_TIMEZONE } from "@/features/orders/calendar-date";
import type { AdminReview, ReviewStatus } from "@/features/reviews/repositories/review-repository";
import { AdminDialog } from "@/shared/ui/admin-dialog";
import { ReviewModerateButton } from "./review-moderate-button";
import { ReviewReplyForm } from "./review-reply-form";
import { overviewHref, type OverviewSelection } from "./overview-range";
import "@/styles/overview-stock-reviews.css";

const TABS: { status: ReviewStatus; label: string }[] = [
  { status: "PENDING", label: "Pending" },
  { status: "PUBLISHED", label: "Published" },
  { status: "HIDDEN", label: "Hidden" },
];

const reviewDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: SHOP_TIMEZONE });

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="ov-stars" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon key={i} size={18} weight={i < rating ? "fill" : "regular"} aria-hidden="true" />
      ))}
    </span>
  );
}

/** The dialog behind Recent Reviews' View all (`?reviews=all`): PENDING / PUBLISHED / HIDDEN tabs, each review with Publish, Hide and Reply. */
export function ReviewsDialog({
  reviews,
  counts,
  tab,
  selection,
  closeHref,
}: {
  reviews: AdminReview[];
  counts: Record<ReviewStatus, number>;
  tab: ReviewStatus;
  selection: OverviewSelection;
  closeHref: string;
}) {
  return (
    <AdminDialog title="Reviews" closeHref={closeHref} size="lg">
      <nav className="rev-tabs" aria-label="Review status">
        {TABS.map(({ status, label }) => (
          <Link
            key={status}
            className="rev-tab"
            href={overviewHref(selection, { reviews: "all", reviewTab: status.toLowerCase() })}
            aria-current={status === tab ? "page" : undefined}
            scroll={false}
          >
            {label} ({counts[status]})
          </Link>
        ))}
      </nav>
      {reviews.length === 0 ? (
        <p className="ov-empty">No {tab.toLowerCase()} reviews.</p>
      ) : (
        <ul className="rev-list">
          {reviews.map((review) => (
            <li key={review.id} className="rev-item">
              <div className="rev-head">
                <strong>{review.reviewerName ?? "Customer"}</strong>
                <span className="ov-cell-sub">{reviewDay.format(review.createdAt)}</span>
              </div>
              <Stars rating={review.rating} />
              <p className="rev-text">{review.body}</p>
              {review.reply && <p className="rev-reply">{review.reply}</p>}
              <div className="rev-actions">
                {review.status !== "PUBLISHED" && <ReviewModerateButton reviewId={review.id} status="PUBLISHED" label="Publish" idempotencyKey={randomUUID()} />}
                {review.status !== "HIDDEN" && <ReviewModerateButton reviewId={review.id} status="HIDDEN" label="Hide" idempotencyKey={randomUUID()} />}
              </div>
              <ReviewReplyForm key={`${review.id}:${review.repliedAt?.getTime() ?? 0}`} reviewId={review.id} existing={review.reply} idempotencyKey={randomUUID()} />
            </li>
          ))}
        </ul>
      )}
    </AdminDialog>
  );
}
