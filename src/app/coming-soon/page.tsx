import "@/styles/landing-theme.css";
import Link from "next/link";
import { COMING_SOON_HERO_IMAGE, getGalleryImageUrl } from "@/features/landing/gallery";
import { SiteNav } from "@/features/landing/site-nav";
import { SiteFooter } from "@/features/landing/site-footer";
import { MobileTabBar } from "@/features/landing/mobile-tabbar";
import { MobileBookBar } from "@/features/landing/mobile-book-bar";

// Generic placeholder for any page/section that isn't built yet (order
// flow, pricing/booking). Linked from the footer's "Contact", the policy
// links and any other not-yet-real CTA — see docs/TODO.md.
export const metadata = {
  title: "Coming Soon — Atunṣe",
};

export default function ComingSoonPage() {
  return (
    <div className="landing" id="landing-root">
      <SiteNav />

      <main className="coming-soon-main">
        <div className="coming-soon-bg" aria-hidden="true" />
        <section className="coming-soon-hero">
          <div className="coming-soon-copy">
            <p className="coming-soon-eyebrow">Page coming soon</p>
            <h1 className="coming-soon-h1">
              Good things
              <span>are in progress.</span>
            </h1>
            <p className="coming-soon-lede">
              We&rsquo;re working on this page to bring you an even better experience. Check back
              soon &mdash; it&rsquo;ll be worth the wait.
            </p>
            <Link href="/" className="coming-soon-back-link">
              <span className="arrow" aria-hidden="true">
                &larr;
              </span>
              Back to home
            </Link>
          </div>
          <div className="coming-soon-visual-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element -- external/S3-resolved URL, not a static import next/image can optimize */}
            <img
              src={getGalleryImageUrl(COMING_SOON_HERO_IMAGE.key)}
              alt={COMING_SOON_HERO_IMAGE.alt}
              width={886}
              height={730}
            />
          </div>
        </section>
      </main>

      <SiteFooter />
      <MobileBookBar />
      <MobileTabBar />
    </div>
  );
}
