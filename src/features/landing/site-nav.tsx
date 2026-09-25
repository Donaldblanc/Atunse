import Link from "next/link";
import { NavDrawer } from "./nav-drawer";
import { ThemeToggle } from "./theme-toggle";

// Shared nav across the marketing surface (/, /coming-soon, /about,
// /services). "Process" still points at /coming-soon — there's no real
// process page yet (docs/TODO.md). Gallery is a real in-page anchor on
// the home page, so it routes through "/" first when viewed elsewhere.
export function SiteNav({ active }: { active?: "about" | "services" }) {
  return (
    <nav className="landing-nav">
      <div className="landing-brand">
        <span className="landing-brand-name">Atunṣe</span>
        <span className="landing-brand-tag">RESTORE &amp; REVIVE</span>
      </div>
      <div className="landing-navlinks">
        <Link href="/services" className={active === "services" ? "active-link" : undefined}>
          Services
        </Link>
        <Link href="/#gallery">Gallery</Link>
        <Link href="/coming-soon">Process</Link>
        <Link href="/about" className={active === "about" ? "active-link" : undefined}>
          About
        </Link>
      </div>
      <div className="landing-nav-actions">
        <ThemeToggle />
        <Link className="landing-btn-primary" href="/booking">
          Book a restoration
          <svg width="14" height="14" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <NavDrawer active={active} />
      </div>
    </nav>
  );
}
