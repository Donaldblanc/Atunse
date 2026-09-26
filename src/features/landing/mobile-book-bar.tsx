"use client";

import { useLayoutEffect, useState } from "react";
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

  useLayoutEffect(() => {
    const topCta = document.querySelector("[data-top-book-cta]");
    if (!topCta) return;

    // Top margin accounts for the sticky nav; bottom margin accounts for
    // the fixed tab bar (68px) plus this bar's own height (~62px) — a CTA
    // sitting in that bottom ~130px (short phones, hero pushed near the
    // fold) would otherwise count as "in view" while the tab bar is
    // actually covering it, hiding this bar with no Book Now visible.
    const topMargin = 68;
    const bottomMargin = 130;

    // Runs before paint so the bar's initial state is already correct —
    // IntersectionObserver's own first callback is async, which would
    // otherwise flash the bar visible for a frame on every page load
    // (the hero CTA is almost always in view at load).
    function isTopCtaVisible() {
      const rect = topCta!.getBoundingClientRect();
      return rect.bottom > topMargin && rect.top < window.innerHeight - bottomMargin;
    }
    setHidden(isTopCtaVisible());

    const observer = new IntersectionObserver(([entry]) => setHidden(Boolean(entry?.isIntersecting)), {
      rootMargin: `-${topMargin}px 0px -${bottomMargin}px 0px`,
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
