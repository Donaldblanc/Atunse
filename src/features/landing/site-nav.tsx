import Link from "next/link";
import { NAV_LINKS, navLinkClass, type NavActive } from "./nav-links";
import { NavDrawer } from "./nav-drawer";
import { ThemeToggle } from "./theme-toggle";
import { BookRestorationCta } from "./book-restoration-cta";

// Shared nav across the marketing surface (/, /coming-soon, /about,
// /services, /process, /contact, /booking). The "Book a restoration" CTA is hidden while
// already on the booking flow itself — no point offering to start what
// you're mid-way through.
export function SiteNav({ active }: { active?: NavActive }) {
  const isBooking = active === "booking";
  return (
    <>
      {/* First thing a keyboard user reaches: jumps past the nav (every page's <main id="main-content">). */}
      <a className="landing-skip-link" href="#main-content">
        Skip to content
      </a>
      <nav className="landing-nav" aria-label="Main">
        <Link href="/" className="landing-brand">
          <span className="landing-brand-name">Atunṣe</span>
          <span className="landing-brand-tag">POWERED BY RESTOREDBYDJ</span>
        </Link>
        <div className="landing-navlinks">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={navLinkClass(link, active)}>
              {link.label}
            </Link>
          ))}
        </div>
        <div className="landing-nav-actions">
          <ThemeToggle />
          {!isBooking && <BookRestorationCta />}
          <NavDrawer active={active} />
        </div>
      </nav>
    </>
  );
}
