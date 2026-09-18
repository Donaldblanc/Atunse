import "@/styles/landing-theme.css";
import { BEFORE_AFTER_IMAGES, HERO_IMAGE, SERVICE_IMAGES, getGalleryImageUrl } from "@/features/landing/gallery";
import { BeforeAfterCarousel } from "@/features/landing/before-after-carousel";
import { BrandMarquee } from "@/features/landing/brand-marquee";
import { ThemeToggle } from "@/features/landing/theme-toggle";

// Customer-facing landing page. Light (default) + dark theme via
// data-theme on #landing-root (src/styles/landing-theme.css), toggled by
// ThemeToggle (adopts system preference on mount, then remembers a manual
// choice). Order submission isn't built yet — CTAs are inert placeholders
// (docs/TODO.md), matching ADR-0005/SPEC.md's Phase 1 status.
const SERVICES = [
  {
    title: "Cleaning",
    description: "Deep clean for a like-new look.",
    image: SERVICE_IMAGES[0],
    icon: (
      <svg width="16" height="16" viewBox="0 0 256 256" fill="none" aria-hidden="true">
        <circle cx="152" cy="96" r="38" stroke="currentColor" strokeWidth="14" />
        <circle cx="88" cy="162" r="24" stroke="currentColor" strokeWidth="14" />
        <circle cx="178" cy="176" r="15" stroke="currentColor" strokeWidth="14" />
      </svg>
    ),
  },
  {
    title: "Restoration",
    description: "Repair, repaint, replace.",
    image: SERVICE_IMAGES[1],
    icon: (
      <svg width="16" height="16" viewBox="0 0 256 256" fill="none" aria-hidden="true">
        <path
          d="M180 48a44 44 0 0 0-56 56L48 180l28 28 76-76a44 44 0 0 0 56-56l-28 28-28-8-8-28Z"
          stroke="currentColor"
          strokeWidth="14"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Protection",
    description: "Premium treatments.",
    image: SERVICE_IMAGES[2],
    icon: (
      <svg width="16" height="16" viewBox="0 0 256 256" fill="none" aria-hidden="true">
        <path
          d="M128 32L208 64V120C208 172 176 208 128 224C80 208 48 172 48 120V64L128 32Z"
          stroke="currentColor"
          strokeWidth="14"
          strokeLinejoin="round"
        />
        <path d="M96 128l22 22l42-52" stroke="currentColor" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Custom Work",
    description: "Color touches & special requests.",
    image: SERVICE_IMAGES[3],
    icon: (
      <svg width="16" height="16" viewBox="0 0 256 256" fill="none" aria-hidden="true">
        <path
          d="M188 28c14 14 14 36 0 50l-84 84-46 14 14-46 84-84c14-14 36-14 50 0Z"
          stroke="currentColor"
          strokeWidth="14"
          strokeLinejoin="round"
        />
        <path d="M100 156c-4 16-16 28-32 32" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
      </svg>
    ),
  },
];

const FAQS = [
  "How does the process work?",
  "How long does restoration take?",
  "Where can I drop off my sneakers?",
  "Do you offer mail-in service?",
  "What if I'm not happy with the results?",
];

export default function HomePage() {
  return (
    <div className="landing" id="landing-root">
      <nav className="landing-nav">
        <div className="landing-brand">
          <span className="landing-brand-name">Atunṣe</span>
          <span className="landing-brand-tag">RESTORE &amp; REVIVE</span>
        </div>
        <div className="landing-navlinks">
          <a href="#services">Services</a>
          <a href="#gallery">Gallery</a>
          <a href="#process">Process</a>
          <a href="#about">About</a>
          <ThemeToggle />
        </div>
        <a className="landing-btn-primary" href="#">
          Book a restoration
          <svg width="14" height="14" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </nav>

      <div className="landing-hero">
        <div>
          <p className="landing-eyebrow">CLEAN / RESTORE / PROTECT</p>
          <h1>
            RESTORE WHAT
            <br />
            MOVES YOU.
          </h1>
          <p className="landing-lede">
            NYC&rsquo;s sneaker studio for cleaning, restoration and protection. Keep your
            favorite pairs in rotation &mdash; longer.
          </p>
          <div className="landing-cta-row">
            <a className="landing-btn-primary" href="#">
              Book a restoration
              <svg width="14" height="14" viewBox="0 0 256 256" fill="none" aria-hidden="true">
                <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a className="landing-link-arrow" href="#gallery">
              View the gallery
              <svg width="13" height="13" viewBox="0 0 256 256" fill="none" aria-hidden="true">
                <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </div>
        <div className="landing-hero-figure">
          <div className="landing-hero-figure-inner">
            {/* eslint-disable-next-line @next/next/no-img-element -- external/S3-resolved URL, not a static import next/image can optimize */}
            <img src={getGalleryImageUrl(HERO_IMAGE.key)} alt={HERO_IMAGE.alt} />
            <div className="landing-hero-note">
              SAME PAIR.
              <br />
              NEW ENERGY.
            </div>
          </div>
        </div>
      </div>

      <div className="landing-trust">
        <div className="landing-trust-item">
          <svg className="landing-trust-icon" width="18" height="18" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <circle cx="128" cy="128" r="88" stroke="currentColor" strokeWidth="16" />
            <path d="M128 76V128L164 152" stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
          </svg>
          <span>
            <strong>72-HOUR</strong>
            <br />
            Turnaround
          </span>
        </div>
        <div className="landing-trust-item">
          <svg className="landing-trust-icon" width="18" height="18" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <path
              d="M128 224S48 152 48 100a80 80 0 0 1 160 0C208 152 128 224 128 224Z"
              stroke="currentColor"
              strokeWidth="16"
            />
            <circle cx="128" cy="100" r="24" stroke="currentColor" strokeWidth="16" />
          </svg>
          <span>
            <strong>NY / NJ / CT</strong>
            <br />
            Local drop-off
          </span>
        </div>
        <div className="landing-trust-item">
          <svg className="landing-trust-icon" width="18" height="18" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <path d="M40 88L128 48L216 88V176L128 216L40 176V88Z" stroke="currentColor" strokeWidth="16" strokeLinejoin="round" />
            <path d="M40 88L128 128L216 88M128 128V216" stroke="currentColor" strokeWidth="16" strokeLinejoin="round" />
          </svg>
          <span>
            <strong>NATIONWIDE</strong>
            <br />
            Mail-in service
          </span>
        </div>
        <div className="landing-trust-badges">
          <span className="landing-trust-label">TRUSTED BY SNEAKER ENTHUSIASTS</span>
          <BrandMarquee />
        </div>
      </div>

      <div className="landing-section-head" id="services">
        <div>
          <h2>Our Services</h2>
          <p>Everything your sneakers need. Thoughtful care, proven results.</p>
        </div>
        <a className="landing-link-arrow" href="#">
          View all services
          <svg width="13" height="13" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
      <div className="landing-services">
        {SERVICES.map((service) => (
          <div className="landing-service-card" key={service.title}>
            <div className="landing-service-photo-wrap">
              <div className="landing-service-photo">
                {/* eslint-disable-next-line @next/next/no-img-element -- external/S3-resolved URL, not a static import next/image can optimize */}
                <img src={getGalleryImageUrl(service.image.key)} alt={service.image.alt} />
              </div>
              <div className="landing-service-badge" aria-hidden="true">
                {service.icon}
              </div>
            </div>
            <div className="landing-service-body">
              <h3>{service.title}</h3>
              <p>{service.description}</p>
              <span className="landing-service-link">
                Learn more
                <svg width="11" height="11" viewBox="0 0 256 256" fill="none" aria-hidden="true">
                  <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="landing-ba-band" id="gallery">
        <BeforeAfterCarousel images={BEFORE_AFTER_IMAGES} />
      </div>

      <div className="landing-lower">
        <div>
          <h2>What People Say</h2>
          <div className="landing-stars" aria-hidden="true">
            ★★★★★
          </div>
          <p className="landing-quote">
            &ldquo;Fast turnaround, amazing results, and great communication. Highly recommend
            Atunṣe!&rdquo;
          </p>
          <div className="landing-reviewer">
            <div className="landing-avatar">JT</div>
            <div>
              <div className="landing-reviewer-name">Jasmine T.</div>
              <div className="landing-reviewer-loc">Newark, NJ</div>
            </div>
          </div>
          <div className="landing-review-nav">
            <button className="landing-review-nav-btn" aria-label="Previous review">
              <svg width="13" height="13" viewBox="0 0 256 256" fill="none" aria-hidden="true">
                <path d="M164 48L92 128L164 208" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className="landing-review-nav-btn" aria-label="Next review">
              <svg width="13" height="13" viewBox="0 0 256 256" fill="none" aria-hidden="true">
                <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div>
          <h2>FAQs</h2>
          {FAQS.map((question) => (
            <div className="landing-faq-item" key={question}>
              <div className="landing-faq-q">
                {question} <span className="landing-faq-plus">+</span>
              </div>
            </div>
          ))}
        </div>

        <div className="landing-booking" id="process">
          <h2>Booking &amp; Pricing</h2>
          <div className="landing-booking-toggle">
            <button data-active="true">In-Person</button>
            <button>Mail-In</button>
          </div>
          <div className="landing-booking-row">
            <span className="landing-booking-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 256 256" fill="none">
                <path d="M128 224S48 152 48 100a80 80 0 0 1 160 0C208 152 128 224 128 224Z" stroke="currentColor" strokeWidth="16" />
              </svg>
            </span>
            <div>
              <strong>NY / NJ / CT locations</strong>
              <span>Drop off at a convenient location</span>
            </div>
          </div>
          <div className="landing-booking-row">
            <span className="landing-booking-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 256 256" fill="none">
                <circle cx="128" cy="128" r="88" stroke="currentColor" strokeWidth="16" />
                <path d="M128 76V128L164 152" stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <strong>Most pairs ready in 72 hours</strong>
            </div>
          </div>
          <div className="landing-booking-row">
            <span className="landing-booking-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 256 256" fill="none">
                <circle cx="128" cy="128" r="88" stroke="currentColor" strokeWidth="16" />
                <path
                  d="M128 72V184M96 96h48a24 24 0 0 1 0 48h-32a24 24 0 0 0 0 48h56"
                  stroke="currentColor"
                  strokeWidth="14"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <div>
              <strong>Pricing from $45</strong>
              <span>Final pricing based on condition and service</span>
            </div>
          </div>
          <a className="landing-btn-primary" href="#">
            View pricing &amp; book now
            <svg width="14" height="14" viewBox="0 0 256 256" fill="none" aria-hidden="true">
              <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>

      <div className="landing-cta-banner">
        <h2>
          SNEAKER CARE FOR
          <br />A BRIGHTER TOMORROW.
        </h2>
        <div className="landing-cta-banner-tag">
          SAME CULTURE.
          <br />
          LONGER MILES.
        </div>
      </div>

      <footer className="landing-footer" id="about">
        <div className="landing-brand">
          <span className="landing-brand-name">Atunṣe</span>
          <span className="landing-brand-tag">RESTORE &amp; REVIVE</span>
        </div>
        <div className="landing-footer-links">
          <a href="#services">Services</a>
          <a href="#gallery">Gallery</a>
          <a href="#process">Process</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
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
    </div>
  );
}
