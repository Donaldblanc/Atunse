import Link from "next/link";
import { NavDrawer } from "./nav-drawer";
import { ThemeToggle } from "./theme-toggle";

// Shared nav across the marketing surface (/ and /coming-soon). "Book a
// restoration" and "Process" point at /coming-soon — there's no real
// order-submission flow or a distinct process page yet (docs/TODO.md).
// Services/Gallery/About are real in-page anchors on the home page, so
// they route through "/" first when viewed from another page.
export function SiteNav() {
  return (
    <nav className="landing-nav">
      <div className="landing-brand">
        <span className="landing-brand-name">Atunṣe</span>
        <span className="landing-brand-tag">RESTORE &amp; REVIVE</span>
      </div>
      <div className="landing-navlinks">
        <Link href="/#services">Services</Link>
        <Link href="/#gallery">Gallery</Link>
        <Link href="/coming-soon">Process</Link>
        <Link href="/#about">About</Link>
      </div>
      <div className="landing-nav-actions">
        <ThemeToggle />
        <Link className="landing-btn-primary" href="/coming-soon">
          Book a restoration
          <svg width="14" height="14" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <NavDrawer />
      </div>
    </nav>
  );
}
