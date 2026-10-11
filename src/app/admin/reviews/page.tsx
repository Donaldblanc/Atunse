// The Reviews screen: the full-list version of the Overview's Recent
// Reviews panel (#130). Same data path and the same Publish / Hide /
// Reply actions as the Overview's Reviews dialog, just as its own page
// instead of a modal over /admin.

import { cookies } from "next/headers";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { buildReviewDeps } from "@/features/reviews/deps";
import { getReviewsByStatus } from "@/features/reviews/use-cases/review-use-cases";
import { parseReviewTab } from "@/features/admin-overview/review-tabs";
import { ReviewList } from "@/features/admin-overview/review-list";
import "@/styles/overview-stock-reviews.css";

export const metadata = { title: "Reviews · Atunṣe Admin" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AdminReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tab = parseReviewTab(params.tab);
  const actingUser = await actingUserFromCookies(await cookies());
  const { reviews, counts } = await getReviewsByStatus(buildReviewDeps(), actingUser, tab);

  return (
    <div className="ov">
      <section className="ov-card" aria-labelledby="reviews-title">
        <div className="ov-card-head">
          <h1 id="reviews-title" className="ov-card-title">
            Reviews
          </h1>
        </div>
        <ReviewList reviews={reviews} counts={counts} tab={tab} tabHref={(status) => `/admin/reviews?tab=${status.toLowerCase()}`} />
      </section>
    </div>
  );
}
