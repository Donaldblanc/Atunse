import "@/styles/landing-theme.css";
import { GALLERY_IMAGES, HERO_IMAGE, getGalleryImageUrl } from "@/features/landing/gallery";
import { GalleryCarousel } from "@/features/landing/gallery-carousel";
import { ThemeToggle } from "@/features/landing/theme-toggle";

// Customer-facing landing page. Defaults to the "Atelier Ledger" light
// theme; ThemeToggle switches to "Night Drop" dark via data-theme on
// #landing-root (src/styles/landing-theme.css defines both as CSS tokens).
// Order submission isn't built yet (docs/SPEC.md Build sequence) — CTAs
// are inert placeholders until that exists.
export default function HomePage() {
  return (
    <div className="landing" id="landing-root">
      <nav className="landing-nav">
        <div className="landing-wordmark">
          Atun<span>ṣ</span>e
        </div>
        <div className="landing-navlinks">
          <a href="#gallery">Restorations</a>
          <a href="#process">Process</a>
          <a href="#contact">Contact</a>
          <ThemeToggle />
        </div>
      </nav>

      <div className="landing-hero">
        <div>
          <p className="landing-eyebrow">RestoredByDJ · NYC sneaker atelier</p>
          <h1>Atunṣe</h1>
          <p className="landing-h1-sub">Yorùbá for restored.</p>
          <p className="landing-lede">
            Hand cleaning and restoration for sneakers that mean something. Drop off across
            the NY/NJ/CT Tri-State, or mail in from anywhere in the country — most pairs come
            back in 72 hours.
          </p>
          <div className="landing-cta-row">
            <a className="landing-btn-primary" href="#">
              Start a restoration
            </a>
            <a className="landing-btn-ghost" href="#gallery">
              View the gallery
            </a>
          </div>
        </div>
        <div className="landing-hero-figure">
          {/* eslint-disable-next-line @next/next/no-img-element -- external/S3-resolved URL, not a static import next/image can optimize */}
          <img src={getGalleryImageUrl(HERO_IMAGE.key)} alt={HERO_IMAGE.alt} />
          <div className="landing-hero-tag">No. 001 — restored</div>
        </div>
      </div>

      <div className="landing-stats">
        <div className="landing-stat">
          <div className="landing-stat-num">72 hr</div>
          <div className="landing-stat-label">typical turnaround</div>
        </div>
        <div className="landing-stat">
          <div className="landing-stat-num">Tri-State</div>
          <div className="landing-stat-label">local pickup &amp; drop-off</div>
        </div>
        <div className="landing-stat">
          <div className="landing-stat-num">50</div>
          <div className="landing-stat-label">states, by mail</div>
        </div>
      </div>

      <div className="landing-gallery-head" id="gallery">
        <h2>The gallery</h2>
        <p>A running record of pairs that have come through the shop — before, and after.</p>
      </div>
      <GalleryCarousel images={GALLERY_IMAGES} />

      <div className="landing-process" id="process">
        <div className="landing-process-inner">
          <h2>How a pair moves through the shop</h2>
          <div className="landing-steps">
            <div className="landing-step">
              <div className="landing-step-num">01</div>
              <h3>Submit &amp; quote</h3>
              <p>
                Send photos of your pair. We review every submission by hand and send back a
                quote — no auto-pricing.
              </p>
            </div>
            <div className="landing-step">
              <div className="landing-step-num">02</div>
              <h3>Drop off or ship</h3>
              <p>
                Bring them by locally anywhere in NY, NJ, or CT, or box them up and mail in
                from anywhere in the country.
              </p>
            </div>
            <div className="landing-step">
              <div className="landing-step-num">03</div>
              <h3>Restored &amp; returned</h3>
              <p>
                Cleaned, restored, and back with you — most pairs in 72 hours from the day we
                receive them.
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer className="landing-footer" id="contact">
        <div>
          <h2>Ready to restore a pair?</h2>
          <p>Tell us what you&apos;re working with and we&apos;ll send a quote within a day.</p>
        </div>
        <div className="landing-foot-meta">
          <span className="accent">RestoredByDJ</span> · New York, NY
          <br />
          Serving NY / NJ / CT + nationwide mail-in
          <br />
          hello@restoredbydj.com
        </div>
      </footer>
    </div>
  );
}
