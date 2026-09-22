"use client";

import { useEffect, useState } from "react";

const REVIEW_INTERVAL_MS = 3000;

export type Review = {
  stars: number;
  quote: string;
  name: string;
  loc: string;
  initials: string;
};

export function ReviewsCarousel({ reviews }: { reviews: Review[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const review = reviews[index] ?? reviews[0];

  function step(dir: 1 | -1) {
    setIndex((current) => (current + dir + reviews.length) % reviews.length);
  }

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => step(1), REVIEW_INTERVAL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- step reads reviews.length, which is stable for the page's lifetime
  }, [paused, reviews.length]);

  if (!review) return null;

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <h2>What People Say</h2>
      <div className="landing-stars" aria-hidden="true">
        {"★★★★★".slice(0, review.stars)}
        {"☆☆☆☆☆".slice(0, 5 - review.stars)}
      </div>
      <p className="landing-quote">&ldquo;{review.quote}&rdquo;</p>
      <div className="landing-reviewer">
        <div className="landing-avatar">{review.initials}</div>
        <div>
          <div className="landing-reviewer-name">{review.name}</div>
          <div className="landing-reviewer-loc">{review.loc}</div>
        </div>
      </div>
      <div className="landing-review-nav">
        <button className="landing-review-nav-btn" aria-label="Previous review" onClick={() => step(-1)}>
          <svg width="13" height="13" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <path d="M164 48L92 128L164 208" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="landing-review-nav-btn" aria-label="Next review" onClick={() => step(1)}>
          <svg width="13" height="13" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
