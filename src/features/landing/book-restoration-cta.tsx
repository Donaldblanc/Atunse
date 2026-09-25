import Link from "next/link";
import { ArrowIcon } from "./arrow-icon";

// Shared "Book a restoration" CTA used across nav, drawer, and every
// marketing page's closing CTA banner. No caller currently needs a style
// variant — add a className prop back (appending, not replacing,
// landing-btn-primary) if one shows up.
export function BookRestorationCta({ onClick }: { onClick?: () => void } = {}) {
  return (
    <Link className="landing-btn-primary" href="/booking" onClick={onClick}>
      Book a restoration
      <ArrowIcon />
    </Link>
  );
}
