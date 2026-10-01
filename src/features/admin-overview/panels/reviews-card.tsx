import { StarIcon } from "@phosphor-icons/react/dist/ssr";
import { calendarDateToUtcMidnight } from "@/features/orders/calendar-date";
import { SAMPLE_REVIEWS, type SampleReview } from "../sample-data";
import { SampleTag } from "./sample-tag";

export function ReviewsCard() {
  return (
    <section className="ov-card" aria-labelledby="ov-reviews-title">
      <div className="ov-card-head">
        <h2 id="ov-reviews-title" className="ov-card-title">
          Recent Reviews
        </h2>
        <SampleTag />
      </div>
      <ul className="ov-reviews">
        {SAMPLE_REVIEWS.map((review) => (
          <Review key={`${review.name}-${review.date}`} review={review} />
        ))}
      </ul>
    </section>
  );
}

const reviewDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function Review({ review }: { review: SampleReview }) {
  const initials = review.name
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
          <strong>{review.name}</strong>
          <span className="ov-cell-sub">{reviewDay.format(calendarDateToUtcMidnight(review.date))}</span>
        </div>
        <span className="ov-stars" role="img" aria-label={`${review.rating} out of 5 stars`}>
          {Array.from({ length: 5 }, (_, i) => (
            <StarIcon key={i} size={18} weight={i < review.rating ? "fill" : "regular"} aria-hidden="true" />
          ))}
        </span>
        <p className="ov-review-text">{review.text}</p>
      </div>
    </li>
  );
}
