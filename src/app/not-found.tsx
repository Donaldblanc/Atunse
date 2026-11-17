import "@/styles/landing-theme.css";
import Link from "next/link";
import { SiteNav } from "@/features/landing/site-nav";
import { SiteFooter } from "@/features/landing/site-footer";
import { MobileTabBar } from "@/features/landing/mobile-tabbar";

// The site's own 404 (unmatched URLs and notFound()), in place of Next's
// unstyled default. Reuses the coming-soon page's layout classes.
export const metadata = {
  title: "Page not found — Atunṣe",
};

export default function NotFound() {
  return (
    <div className="landing" id="landing-root">
      <SiteNav />

      <main id="main-content" tabIndex={-1} className="coming-soon-main">
        <div className="coming-soon-bg" aria-hidden="true" />
        <section className="coming-soon-hero">
          <div className="coming-soon-copy">
            <p className="coming-soon-eyebrow">404</p>
            <h1 className="coming-soon-h1">
              We can&rsquo;t find
              <span>that page.</span>
            </h1>
            <p className="coming-soon-lede">
              The link may be old or mistyped. Head back home, or book a restoration and we&rsquo;ll take it from there.
            </p>
            <Link href="/" className="coming-soon-back-link">
              <span className="arrow" aria-hidden="true">
                &larr;
              </span>
              Back to home
            </Link>
            <p>
              <Link href="/booking" className="landing-btn-primary">
                Book a restoration
              </Link>
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
