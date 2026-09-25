import Link from "next/link";
import { ArrowIcon } from "./arrow-icon";

// Shared "Book a restoration" CTA used across nav, drawer, and every
// marketing page's closing CTA banner.
export function BookRestorationCta({
  className = "landing-btn-primary",
  onClick,
}: {
  className?: string;
  onClick?: () => void;
} = {}) {
  return (
    <Link className={className} href="/booking" onClick={onClick}>
      Book a restoration
      <ArrowIcon />
    </Link>
  );
}
