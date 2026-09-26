import Link from "next/link";
import { ArrowIcon } from "./arrow-icon";

// Shared "Book Now" CTA used across nav, drawer, and every marketing
// page's closing CTA banner. No caller currently needs a style variant —
// add a className prop back (appending, not replacing, landing-btn-primary)
// if one shows up.
export function BookRestorationCta({
  onClick,
  topCta,
}: {
  onClick?: () => void;
  /** Marks this instance as the page's primary/hero CTA — MobileBookBar
   * watches for this to hide the sticky bar while it's in view, so the
   * two "Book Now" buttons never show on screen at the same time. */
  topCta?: boolean;
} = {}) {
  return (
    <Link className="landing-btn-primary" href="/booking" onClick={onClick} data-top-book-cta={topCta || undefined}>
      Book Now
      <ArrowIcon />
    </Link>
  );
}
