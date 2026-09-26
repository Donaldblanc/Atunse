"use client";

import { useEffect, useState } from "react";
import { BookRestorationCta } from "./book-restoration-cta";

// Persistent "Book Now" CTA on mobile, stacked above MobileTabBar — so a
// customer scrolling far down a page (likely arriving from an Instagram
// link on their phone) never has to scroll back to the top to book.
// Rendered on every marketing page except /booking itself (no point
// offering to start what you're already mid-way through). Hides itself
// while the page's own hero/primary "Book Now" CTA (marked topCta on
// BookRestorationCta) is in view, so the two never show at once — pages
// with no topCta instance (e.g. /coming-soon) just always show this bar.
export function MobileBookBar() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const topCta = document.querySelector("[data-top-book-cta]");
    if (!topCta) return;

    const observer = new IntersectionObserver(([entry]) => setHidden(Boolean(entry?.isIntersecting)), {
      rootMargin: "-68px 0px 0px 0px",
    });
    observer.observe(topCta);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="landing-mobile-book-bar-spacer" hidden={hidden} />
      <div className="landing-mobile-book-bar" hidden={hidden}>
        <BookRestorationCta />
      </div>
    </>
  );
}
