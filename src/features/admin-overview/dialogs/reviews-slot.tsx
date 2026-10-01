import { buildReviewDeps } from "@/features/reviews/deps";
import { getReviewsByStatus } from "@/features/reviews/use-cases/review-use-cases";
import { parseReviewTab } from "../review-tabs";
import { ReviewsDialog } from "../reviews-dialog";
import type { OverviewDialogContext, OverviewParams } from "./overview-dialog-context";

export const matchesReviews = (params: OverviewParams) => params.reviews === "all";

export async function ReviewsSlot({ params, selection, actingUser, closeHref }: OverviewDialogContext) {
  const tab = parseReviewTab(params.reviewTab);
  const { reviews, counts } = await getReviewsByStatus(buildReviewDeps(), actingUser, tab);
  return <ReviewsDialog reviews={reviews} counts={counts} tab={tab} selection={selection} closeHref={closeHref} />;
}
