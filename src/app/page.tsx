import Link from "next/link";
import { Droplets, Wrench, ShieldCheck, Palette, Clock, MapPin, Truck } from "lucide-react";
import "@/styles/landing-theme.css";
import { BEFORE_AFTER_IMAGES, HERO_IMAGE, SERVICE_IMAGES, getGalleryImageUrl } from "@/features/landing/gallery";
import { BeforeAfterCarousel } from "@/features/landing/before-after-carousel";
import { BookingPanel } from "@/features/landing/booking-panel";
import { FaqAccordion } from "@/features/landing/faq-accordion";
import { ReviewsCarousel } from "@/features/landing/reviews-carousel";
import { BrandMarquee } from "@/features/landing/brand-marquee";
import { SiteNav } from "@/features/landing/site-nav";
import { SiteFooter } from "@/features/landing/site-footer";
import { MobileTabBar } from "@/features/landing/mobile-tabbar";

// Customer-facing landing page. Light (default) + dark theme via
// data-theme on #landing-root (src/styles/landing-theme.css), toggled by
// ThemeToggle (adopts system preference on mount, then remembers a manual
// choice, inside SiteNav). Order submission isn't built yet — CTAs that
// don't have a real destination route to /coming-soon instead of a dead
// "#" (docs/TODO.md), matching ADR-0005/SPEC.md's Phase 1 status.
const SERVICES = [
  {
    title: "Cleaning",
    description: "Deep clean for a like-new look.",
    image: SERVICE_IMAGES[0],
    icon: <Droplets size={16} aria-hidden="true" />,
  },
  {
    title: "Restoration",
    description: "Repair, repaint, replace.",
    image: SERVICE_IMAGES[1],
    icon: <Wrench size={16} aria-hidden="true" />,
  },
  {
    title: "Protection",
    description: "Premium treatments.",
    image: SERVICE_IMAGES[2],
    icon: <ShieldCheck size={16} aria-hidden="true" />,
  },
  {
    title: "Custom Work",
    description: "Color touches & special requests.",
    image: SERVICE_IMAGES[3],
    icon: <Palette size={16} aria-hidden="true" />,
  },
];

const FAQS = [
  {
    question: "How does the process work?",
    answer:
      "Drop off or ship us your sneakers, we send a quote, and once approved our team gets to work restoring them.",
  },
  {
    question: "How long does restoration take?",
    answer: "Most restorations take 5-10 business days depending on the service and current order volume.",
  },
  {
    question: "Where can I drop off my sneakers?",
    answer: "You can drop off in person at our Newark studio, or ship them to us using a prepaid mail-in label.",
  },
  {
    question: "Do you offer mail-in service?",
    answer: "Yes, we ship a prepaid label so you can send your sneakers from anywhere in the country.",
  },
  {
    question: "What if I'm not happy with the results?",
    answer: "Let us know within 7 days of pickup or delivery and we'll make it right at no extra cost.",
  },
];

const REVIEWS = [
  {
    stars: 5,
    quote: "Fast turnaround, amazing results, and great communication. Highly recommend Atunṣe!",
    name: "Jasmine T.",
    loc: "Newark, NJ",
    initials: "JT",
  },
  {
    stars: 5,
    quote: "My Jordan 1s came back looking brand new. DJ walked me through everything before he started.",
    name: "Marcus O.",
    loc: "Brooklyn, NY",
    initials: "MO",
  },
  {
    stars: 5,
    quote: "Dropped off a pair I thought were done for. Got them back like they just came out of the box.",
    name: "Priya R.",
    loc: "Jersey City, NJ",
    initials: "PR",
  },
  {
    stars: 4,
    quote: "Great work on a tough yellowing job. Took a little longer than expected but worth the wait.",
    name: "Aaron K.",
    loc: "Queens, NY",
    initials: "AK",
  },
  {
    stars: 5,
    quote: "Booking was easy and the updates along the way made me trust the process. Will be back.",
    name: "Devon L.",
    loc: "Newark, NJ",
    initials: "DL",
  },
  {
    stars: 5,
    quote: "Best sneaker restoration in the city, hands down. Attention to detail is unmatched.",
    name: "Sofia M.",
    loc: "Manhattan, NY",
    initials: "SM",
  },
];

export default function HomePage() {
  return (
    <div className="landing" id="landing-root">
      <SiteNav />

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
            <Link className="landing-btn-primary" href="/booking">
              Book a restoration
              <svg width="14" height="14" viewBox="0 0 256 256" fill="none" aria-hidden="true">
                <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
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
          <Clock className="landing-trust-icon" size={18} aria-hidden="true" />
          <span>
            <strong>72-HOUR</strong>
            <br />
            Turnaround
          </span>
        </div>
        <div className="landing-trust-item">
          <MapPin className="landing-trust-icon" size={18} aria-hidden="true" />
          <span>
            <strong>NY / NJ / CT</strong>
            <br />
            Local drop-off
          </span>
        </div>
        <div className="landing-trust-item">
          <Truck className="landing-trust-icon" size={18} aria-hidden="true" />
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
        <Link className="landing-link-arrow" href="/coming-soon">
          View all services
          <svg width="13" height="13" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <path d="M92 48L164 128L92 208" stroke="currentColor" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
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
        <ReviewsCarousel reviews={REVIEWS} />

        <FaqAccordion faqs={FAQS} />

        <BookingPanel />
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

      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
