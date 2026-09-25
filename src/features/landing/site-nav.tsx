import Link from "next/link";
import { NAV_LINKS } from "./nav-links";
import { NavDrawer } from "./nav-drawer";
import { ThemeToggle } from "./theme-toggle";
import { BookRestorationCta } from "./book-restoration-cta";

// Shared nav across the marketing surface (/, /coming-soon, /about,
// /services, /booking). The "Book a restoration" CTA is hidden while
// already on the booking flow itself — no point offering to start what
// you're mid-way through.
export function SiteNav({ active }: { active?: "about" | "services" | "booking" }) {
  const isBooking = active === "booking";
  return (
    <nav className="landing-nav">
      <Link href="/" className="landing-brand">
        <span className="landing-brand-name">Atunṣe</span>
        <span className="landing-brand-tag">RESTORE &amp; REVIVE</span>
      </Link>
      <div className="landing-navlinks">
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={link.activeKey === active ? "active-link" : undefined}>
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
  );
}
