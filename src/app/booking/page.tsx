import Link from "next/link";
import { Calendar, Package, Sparkles, SportShoe } from "lucide-react";
import { pageMetadata } from "@/shared/site/page-metadata";
import { Suspense } from "react";
import "@/styles/landing-theme.css";
import { SiteNav } from "@/features/landing/site-nav";
import { SiteFooter } from "@/features/landing/site-footer";
import { MobileTabBar } from "@/features/landing/mobile-tabbar";
import { BookingFlow } from "@/features/booking/booking-flow";
import { loadCatalog } from "@/features/services/site-catalog";
import { loadSiteSettings } from "@/features/settings/site-settings";

export const metadata = pageMetadata({
  title: "Book a Restoration — Atunṣe",
  description:
    "Book a sneaker cleaning or restoration in a few steps: choose a service, add your pair's details, and pick Local Drop-Off in NY/NJ/CT or Mail-In.",
  path: "/booking",
});

const HOW_IT_WORKS = [
  {
    title: "Book your service",
    description: "Choose the service your pair needs and fill out a few quick details.",
    icon: Calendar,
  },
  {
    title: "Book a Local Drop-Off or mail it in",
    description: "DJ collects it from your address in NY/NJ/CT, or you ship it to us with the instructions we email you.",
    icon: Package,
  },
  {
    title: "We restore it",
    description: "Our experts get to work, keeping you updated along the way.",
    icon: Sparkles,
  },
  {
    title: "Get them back fresh",
    description: "DJ drops your pair back off, or we ship it back to you.",
    icon: SportShoe,
  },
];

// A safety net: an admin save revalidates the site at once; this catches anything that changed another way.
export const revalidate = 3600;

export default async function BookingPage() {
  // Read on the server so the address never needs a NEXT_PUBLIC variable.
  const cancelEmail = process.env.CONTACT_EMAIL?.trim() || null;
  const [catalog, settings] = await Promise.all([loadCatalog(), loadSiteSettings()]);
  // Settings can switch both Fulfillment Methods off: nothing can be booked online then.
  const bookingOpen = settings.allowLocalDropOff || settings.allowMailIn;
  return (
    <div className="landing" id="landing-root">
      <SiteNav active="booking" />
      <main id="main-content" tabIndex={-1}>

      <div className="landing-about-hero booking-page-hero">
        <div>
          <p className="landing-eyebrow">BOOK A RESTORATION</p>
          <h1>
            Send Us Your Pair.
            <span>We&rsquo;ll Handle the Rest.</span>
          </h1>
          <p className="landing-lede">
            A simple booking process to get your sneakers cleaned, restored, and back in rotation.
            Tell us what you need, book a Local Drop-Off or ship us your pair, and we&rsquo;ll take care of the rest.
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

      {bookingOpen ? (
        <Suspense fallback={null}>
          <BookingFlow cancelEmail={cancelEmail} catalog={catalog} settings={settings} />
        </Suspense>
      ) : (
        <div className="landing-section-head booking-page-how-head">
          <div>
            <h2>We&rsquo;re not taking online bookings right now.</h2>
            <p>
              Please <Link href="/contact?topic=booking" className="landing-link-arrow">contact us</Link> and we&rsquo;ll help you directly.
            </p>
          </div>
        </div>
      )}

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

      </main>

      <SiteFooter active="booking" />
      <MobileTabBar />
    </div>
  );
}
