import type { AdminReview, ReviewStatus } from "@/features/reviews/repositories/review-repository";
import { AdminDialog } from "@/shared/ui/admin-dialog";
import { ReviewList, Stars } from "./review-list";
import { overviewHref, type OverviewSelection } from "./overview-range";
import "@/styles/overview-stock-reviews.css";

export { Stars };

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
      <ReviewList
        reviews={reviews}
        counts={counts}
        tab={tab}
        tabHref={(status) => overviewHref(selection, { reviews: "all", reviewTab: status.toLowerCase() })}
      />
    </AdminDialog>
  );
}
