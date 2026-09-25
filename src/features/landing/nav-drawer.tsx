"use client";

// Mobile hamburger + slide-in drawer for secondary nav links, rendered
// inside SiteNav. Hidden above the 640px breakpoint (landing-theme.css).
import Link from "next/link";
import { useState } from "react";
import { NAV_LINKS, navLinkClass, type NavActive } from "./nav-links";
import { BookRestorationCta } from "./book-restoration-cta";

export function NavDrawer({ active }: { active?: NavActive } = {}) {
  const [open, setOpen] = useState(false);
  const isBooking = active === "booking";

  return (
    <>
      <button
        type="button"
        className="landing-hamburger"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <svg width="18" height="18" viewBox="0 0 256 256" fill="none" aria-hidden="true">
          <path d="M40 72h176M40 128h176M40 184h176" stroke="currentColor" strokeWidth="20" strokeLinecap="round" />
        </svg>
      </button>

      <div
        className="landing-drawer-backdrop"
        data-open={open}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div className="landing-drawer" data-open={open}>
        <div className="landing-drawer-top">
          <span className="landing-brand-name">Menu</span>
          <button
            type="button"
            className="landing-drawer-close"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <svg width="16" height="16" viewBox="0 0 256 256" fill="none" aria-hidden="true">
              <path d="M64 64l128 128M192 64L64 192" stroke="currentColor" strokeWidth="20" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav onClick={() => setOpen(false)}>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={navLinkClass(link, active)}>
              {link.label}
            </Link>
          ))}
        </nav>
        {!isBooking && (
          <div className="landing-drawer-cta">
            <BookRestorationCta onClick={() => setOpen(false)} />
          </div>
        )}
      </div>
    </>
  );
}
