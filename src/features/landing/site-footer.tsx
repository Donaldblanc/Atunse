import Link from "next/link";

export function SiteFooter({ active }: { active?: "about" } = {}) {
  return (
    <>
      <footer className="landing-footer">
        <div className="landing-brand">
          <span className="landing-brand-name">Atunṣe</span>
          <span className="landing-brand-tag">RESTORE &amp; REVIVE</span>
        </div>
        <div className="landing-footer-links">
          <Link href="/#services">Services</Link>
          <Link href="/#gallery">Gallery</Link>
          <Link href="/coming-soon">Process</Link>
          <Link href="/about" className={active === "about" ? "active-link" : undefined}>
            About
          </Link>
          <Link href="/coming-soon">Contact</Link>
        </div>
        <div className="landing-footer-social">
          <span className="landing-social-icon" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 256 256" fill="none">
              <rect x="48" y="48" width="160" height="160" rx="40" stroke="currentColor" strokeWidth="16" />
              <circle cx="128" cy="128" r="36" stroke="currentColor" strokeWidth="16" />
              <circle cx="176" cy="80" r="8" fill="currentColor" />
            </svg>
          </span>
          <span className="landing-social-icon" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 256 256" fill="none">
              <path
                d="M80 48v128a32 32 0 1 0 32 32V96c16 16 40 24 64 24"
                stroke="currentColor"
                strokeWidth="16"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="landing-social-icon" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 256 256" fill="none">
              <rect x="40" y="64" width="176" height="128" rx="16" stroke="currentColor" strokeWidth="16" />
              <path d="M104 100l56 28-56 28Z" fill="currentColor" />
            </svg>
          </span>
        </div>
      </footer>
      <div className="landing-footer-bottom">
        <span>&copy; 2026 Atunṣe. All rights reserved.</span>
        <span>RestoredByDJ &middot; New York, NY</span>
      </div>
    </>
  );
}
