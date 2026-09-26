import { BookRestorationCta } from "./book-restoration-cta";

// Persistent "Book Now" CTA on mobile, stacked above MobileTabBar — so a
// customer scrolling far down a page (likely arriving from an Instagram
// link on their phone) never has to scroll back to the top to book.
// Rendered on every marketing page except /booking itself (no point
// offering to start what you're already mid-way through).
export function MobileBookBar() {
  return (
    <>
      <div className="landing-mobile-book-bar-spacer" />
      <div className="landing-mobile-book-bar">
        <BookRestorationCta />
      </div>
    </>
  );
}
