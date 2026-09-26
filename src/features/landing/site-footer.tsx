import Link from "next/link";
import { NAV_LINKS, navLinkClass, type NavActive } from "./nav-links";

export function SiteFooter({ active }: { active?: NavActive } = {}) {
  return (
    <>
      <footer className="landing-footer">
        <div className="landing-brand">
          <span className="landing-brand-name">Atunṣe</span>
          <span className="landing-brand-tag">POWERED BY RESTOREDBYDJ</span>
        </div>
        <div className="landing-footer-links">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={navLinkClass(link, active)}>
              {link.label}
            </Link>
          ))}
          <Link href="/coming-soon">Contact</Link>
        </div>
        <div className="landing-footer-social">
          <a
            className="landing-social-icon"
            href="https://www.instagram.com/RestoredByDJ"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram: @RestoredByDJ"
          >
            <svg width="15" height="15" viewBox="0 0 256 256" fill="none" aria-hidden="true">
              <rect x="48" y="48" width="160" height="160" rx="40" stroke="currentColor" strokeWidth="16" />
              <circle cx="128" cy="128" r="36" stroke="currentColor" strokeWidth="16" />
              <circle cx="176" cy="80" r="8" fill="currentColor" />
            </svg>
          </a>
          <a
            className="landing-social-icon"
            href="https://www.tiktok.com/@RestoredByDJ"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="TikTok: @RestoredByDJ"
          >
            <svg width="15" height="15" viewBox="0 0 256 256" fill="none" aria-hidden="true">
              <path
                d="M80 48v128a32 32 0 1 0 32 32V96c16 16 40 24 64 24"
                stroke="currentColor"
                strokeWidth="16"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <a
            className="landing-social-icon"
            href="https://www.youtube.com/@RestoredByDj"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="YouTube: @RestoredByDj"
          >
            <svg width="15" height="15" viewBox="0 0 256 256" fill="none" aria-hidden="true">
              <rect x="40" y="64" width="176" height="128" rx="16" stroke="currentColor" strokeWidth="16" />
              <path d="M104 100l56 28-56 28Z" fill="currentColor" />
            </svg>
          </a>
        </div>
      </footer>
      <div className="landing-footer-bottom">
        <span>&copy; 2026 Atunṣe. All rights reserved.</span>
        <span>RestoredByDJ &middot; New York, NY</span>
      </div>
    </>
  );
}
