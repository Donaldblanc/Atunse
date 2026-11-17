import Link from "next/link";
import { NAV_LINKS, navLinkClass, type NavActive } from "./nav-links";
import { LEGAL_DOCUMENTS } from "@/shared/legal-documents";
import { dmcaAgent } from "@/shared/dmca-agent";
import { loadSiteSettings } from "@/features/settings/site-settings";
import { isCustomerSignInEnabled } from "@/shared/config/feature-flags";
import { businessProfile, loadBusinessProfile, type BusinessProfile } from "./business-profile";

/** The footer with the business profile from Settings (the name, location and contact details), when it can be read. */
export async function SiteFooter({ active }: { active?: NavActive } = {}) {
  return <SiteFooterView active={active} profile={await loadBusinessProfile(loadSiteSettings)} accountLink={isCustomerSignInEnabled()} />;
}

export function SiteFooterView({
  active,
  profile = businessProfile(null),
  accountLink = false,
}: {
  active?: NavActive;
  profile?: BusinessProfile;
  /** Show "My bookings" (only while customer sign-in is on). */
  accountLink?: boolean;
}) {
  const name = profile.name ?? "Atunṣe";
  return (
    <footer>
      <div className="landing-footer">
        <div className="landing-brand">
          <span className="landing-brand-name">{name}</span>
          <span className="landing-brand-tag">POWERED BY RESTOREDBYDJ</span>
        </div>
        <div className="landing-footer-links">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={navLinkClass(link, active)}>
              {link.label}
            </Link>
          ))}
          {accountLink && <Link href="/account">My bookings</Link>}
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
      </div>
      <div className="landing-footer-bottom">
        <span>&copy; 2026 {name}. All rights reserved.</span>
        {/* The legal PDFs, open in a new tab (shared/legal-documents.ts). */}
        <nav className="landing-footer-legal" aria-label="Legal">
          {LEGAL_DOCUMENTS.map((doc) => (
            <a key={doc.href} href={doc.href} target="_blank" rel="noopener noreferrer">
              {doc.title}
              <span className="landing-visually-hidden"> (PDF, opens in a new tab)</span>
            </a>
          ))}
          {/* Only once a DMCA Designated Agent is configured (shared/dmca-agent.ts). */}
          {dmcaAgent() && <Link href="/copyright">Copyright</Link>}
        </nav>
        <span>RestoredByDJ &middot; {profile.location ?? "New York, NY"}</span>
        {(profile.email || profile.phone) && (
          <span>
            {profile.email && <a href={`mailto:${profile.email}`}>{profile.email}</a>}
            {profile.email && profile.phone && " · "}
            {profile.phone && <a href={`tel:${profile.phone.replace(/[^\d+]/g, "")}`}>{profile.phone}</a>}
          </span>
        )}
      </div>
    </footer>
  );
}
