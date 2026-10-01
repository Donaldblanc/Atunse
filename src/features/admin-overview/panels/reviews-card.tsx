import Link from "next/link";
import { cookies } from "next/headers";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { SHOP_TIMEZONE } from "@/features/orders/calendar-date";
import { buildReviewDeps } from "@/features/reviews/deps";
import { getLatestReviews } from "@/features/reviews/use-cases/review-use-cases";
import type { AdminReview } from "@/features/reviews/repositories/review-repository";
import { overviewHref, type OverviewSelection } from "../overview-range";
import { Stars } from "../reviews-dialog";

const reviewDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: SHOP_TIMEZONE });

/** Recent Reviews: the latest PUBLISHED ones, loaded here (its own data path, not getAdminOverview). */
export async function ReviewsCard({ selection }: { selection: OverviewSelection }) {
  const actingUser = await actingUserFromCookies(await cookies());
  const reviews = await getLatestReviews(buildReviewDeps(), actingUser);
  return (
    <section className="ov-card" aria-labelledby="ov-reviews-title">
      <div className="ov-card-head">
        <h2 id="ov-reviews-title" className="ov-card-title">
          Recent Reviews
        </h2>
        <Link className="ov-card-link" href={overviewHref(selection, { reviews: "all" })} scroll={false}>
          View all
        </Link>
      </div>
      {reviews.length === 0 ? (
        <p className="ov-empty">No reviews yet.</p>
      ) : (
        <ul className="ov-reviews">
          {reviews.map((review) => (
            <Review key={review.id} review={review} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Review({ review }: { review: AdminReview }) {
  const name = review.reviewerName ?? "Customer";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <li className="ov-review">
      <span className="ov-review-avatar" aria-hidden="true">
        {initials}
      </span>
      <div className="ov-review-body">
        <div className="ov-review-head">
          <strong>{name}</strong>
          <span className="ov-cell-sub">{reviewDay.format(review.publishedAt ?? review.createdAt)}</span>
        </div>
        <Stars rating={review.rating} />
        <p className="ov-review-text">{review.body}</p>
      </div>
    </li>
  );
}
