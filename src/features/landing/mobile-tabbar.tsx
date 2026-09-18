"use client";

// Fixed bottom tab bar simulating a native app's primary nav on mobile.
// Hidden above the 640px breakpoint (landing-theme.css). Rendered at the
// end of both / and /coming-soon so it's present on every marketing page.
import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileTabBar() {
  const pathname = usePathname();
  const isComingSoon = pathname === "/coming-soon";

  return (
    <>
      <div className="landing-tabbar-spacer" />
      <nav className="landing-tabbar" aria-label="Primary">
        <Link href="/" data-active={isComingSoon ? "false" : "true"}>
          <svg width="20" height="20" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <path
              d="M40 112L128 40L216 112V216H160V152H96V216H40V112Z"
              stroke="currentColor"
              strokeWidth="16"
              strokeLinejoin="round"
            />
          </svg>
          Home
        </Link>
        <Link href="/#services" data-active="false">
          <svg width="20" height="20" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <rect x="40" y="40" width="76" height="76" rx="8" stroke="currentColor" strokeWidth="16" />
            <rect x="140" y="40" width="76" height="76" rx="8" stroke="currentColor" strokeWidth="16" />
            <rect x="40" y="140" width="76" height="76" rx="8" stroke="currentColor" strokeWidth="16" />
            <rect x="140" y="140" width="76" height="76" rx="8" stroke="currentColor" strokeWidth="16" />
          </svg>
          Services
        </Link>
        <Link href="/#gallery" data-active="false">
          <svg width="20" height="20" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <rect x="32" y="56" width="192" height="144" rx="12" stroke="currentColor" strokeWidth="16" />
            <circle cx="92" cy="108" r="16" stroke="currentColor" strokeWidth="16" />
            <path d="M32 172l56-48 40 32 32-28 64 56" stroke="currentColor" strokeWidth="16" strokeLinejoin="round" />
          </svg>
          Gallery
        </Link>
        <Link href="/coming-soon" data-active={isComingSoon ? "true" : "false"}>
          <svg width="20" height="20" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <rect x="40" y="56" width="176" height="152" rx="12" stroke="currentColor" strokeWidth="16" />
            <path d="M40 100h176M84 40v32M172 40v32" stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
          </svg>
          Book
        </Link>
      </nav>
    </>
  );
}
