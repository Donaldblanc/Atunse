import { Calendar, Package, Sparkles, SportShoe } from "lucide-react";
import { Suspense } from "react";
import "@/styles/landing-theme.css";
import { SiteNav } from "@/features/landing/site-nav";
import { SiteFooter } from "@/features/landing/site-footer";
import { MobileTabBar } from "@/features/landing/mobile-tabbar";
import { BookingFlow } from "@/features/booking/booking-flow";

export const metadata = {
  title: "Book a Restoration — Atunṣe",
};

const HOW_IT_WORKS = [
  {
    title: "Book your service",
    description: "Choose the service your pair needs and fill out a few quick details.",
    icon: Calendar,
  },
  {
    title: "Drop off or send your pair",
    description: "Bring it to our location or ship it to us with the provided instructions.",
    icon: Package,
  },
  {
    title: "We restore it",
    description: "Our experts get to work, keeping you updated along the way.",
    icon: Sparkles,
  },
  {
    title: "Get them back fresh",
    description: "Your sneakers are returned clean, restored, and ready for what's next.",
    icon: SportShoe,
  },
];

export default function BookingPage() {
  return (
    <div className="landing" id="landing-root">
      <SiteNav active="booking" />

      <div className="landing-about-hero booking-page-hero">
        <div>
          <p className="landing-eyebrow">BOOK A RESTORATION</p>
          <h1>
            Send Us Your Pair.
            <span>We&rsquo;ll Handle the Rest.</span>
          </h1>
          <p className="landing-lede">
            A simple booking process to get your sneakers cleaned, restored, and back in rotation.
            Tell us what you need, ship or drop off your pair, and we&rsquo;ll take care of the rest.
          </p>
        </div>
        <div className="landing-about-cta-tagline">
          <span className="rule" />
          <div className="landing-about-cta-tagline-text">
            <div>
              SAME
              <br />
              CULTURE.
              <br />
              BRIGHTER
              <br />
              DAYS.
            </div>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <BookingFlow />
      </Suspense>

      <div className="landing-section-head booking-page-how-head">
        <div>
          <p className="landing-eyebrow">HOW IT WORKS</p>
          <h2>A cleaner, brighter process.</h2>
        </div>
      </div>
      <div className="booking-page-how-grid">
        {HOW_IT_WORKS.map((step, index) => {
          const Icon = step.icon;
          return (
            <div className="booking-page-how-card" key={step.title}>
              <span className="booking-page-how-num">{index + 1}</span>
              <span className="booking-page-how-icon" aria-hidden="true">
                <Icon size={24} />
              </span>
              <strong>{step.title}</strong>
              <span>{step.description}</span>
            </div>
          );
        })}
      </div>

      <SiteFooter active="booking" />
      <MobileTabBar />
    </div>
  );
}
