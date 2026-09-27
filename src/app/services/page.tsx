import Link from "next/link";
import { Check, ChevronDown, Clock, Palette, Sparkles, Wrench } from "lucide-react";
import "@/styles/landing-theme.css";
import { SiteNav } from "@/features/landing/site-nav";
import { SiteFooter } from "@/features/landing/site-footer";
import { MobileTabBar } from "@/features/landing/mobile-tabbar";
import { MobileBookBar } from "@/features/landing/mobile-book-bar";
import { BookRestorationCta } from "@/features/landing/book-restoration-cta";
import { ArrowIcon } from "@/features/landing/arrow-icon";
import { catalogService, formatPrice, formatServicePrice, suedeFeeNote } from "@/features/orders/service-catalog";

// Every price on this page comes from SERVICE_CATALOG, the same source the
// booking flow and the server's estimate use.
const standard = catalogService("standard");
const premium = catalogService("premium");
const oxidation = catalogService("oxidation");
const painting = catalogService("painting");
const reglue = catalogService("reglue");

export const metadata = {
  title: "Services & Pricing — Atunṣe",
};

const CLEANING_PLANS = [
  {
    serviceId: "standard",
    label: "STANDARD CLEAN",
    price: formatServicePrice(standard),
    priceNote: standard.suedeFee ? suedeFeeNote(false) : undefined,
    description: "A deep, thorough clean to keep your sneakers looking and feeling fresh.",
    checklist: [
      "Laces detached & scrubbed clean",
      "Uppers thoroughly deep-cleaned",
      "Midsole & outsole treated",
      "Interior fully sanitized",
      "Freshened & deodorized",
      "Finished with Crep Protection Shoe Deodorizer & Protection Spray",
    ],
    cta: "Book Standard Clean",
    badge: undefined as string | undefined,
  },
  {
    serviceId: "premium",
    label: "PREMIUM CLEAN",
    price: formatServicePrice(premium),
    priceNote: premium.suedeFee ? suedeFeeNote(false) : undefined,
    description: "Our most detailed clean, designed for high-end and heavily worn pairs.",
    checklist: [
      "Targeted stain treatment",
      "Careful handling of premium materials",
      "Detailed & meticulous finishing",
      "Safe for designer & luxury pairs",
    ],
    cta: "Book Premium Clean",
    badge: "MOST POPULAR" as string | undefined,
  },
];

const RESTORATION_SERVICES = [
  {
    icon: Sparkles,
    title: "OXIDATION RESTORATION",
    description: "Reduces yellowing and discoloration, restoring the clean, bright appearance of oxidized soles and midsoles.",
    subitems: [
      { label: (oxidation.minimumLabel ?? "From").toUpperCase(), price: `From ${formatPrice(oxidation.baseCents, oxidation.isMinimum)}` },
      ...(oxidation.alsoFrom ?? []).map((part) => ({ label: part.label.toUpperCase(), price: `From ${formatPrice(part.cents, true)}` })),
    ],
  },
  {
    icon: Palette,
    title: "SNEAKER PAINTING & DYEING",
    description: "Custom color changes, touch-ups, and dye work to refresh, restore, or transform your shoes.",
    price: formatPrice(painting.baseCents, painting.isMinimum),
  },
  {
    icon: Wrench,
    title: "REGLUE",
    description: "Professional sole separation repair to securely reattach and restore your sneakers.",
    price: formatPrice(reglue.baseCents, reglue.isMinimum),
  },
];

export default function ServicesPage() {
  return (
    <div className="landing" id="landing-root">
      <SiteNav active="services" />

      <div className="services-page-hero">
        <div>
          <p className="landing-eyebrow">PRICING</p>
          <h1>
            Complete Sneaker Care.
            <span>Made Right Again.</span>
          </h1>
          <p className="landing-lede">
            From everyday cleaning to full restorations, we help bring new life to the sneakers you love.
          </p>
          <div className="landing-cta-row">
            <BookRestorationCta topCta />
            <a className="services-page-btn-outline" href="#pricing-cleaning">
              See our process
              <ChevronDown size={13} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="services-page-mark">
          <span className="services-page-mark-rule" />
          <div className="services-page-mark-list">
            <span>CLEAN</span>
            <span>RESTORE</span>
            <span>PROTECT</span>
            <span>REPEAT</span>
            <div className="services-page-mark-rule-bottom" />
          </div>
        </div>
      </div>

      <div className="services-page-divider" />

      <div className="services-page-section-head" id="pricing-cleaning">
        <p className="landing-eyebrow">CLEANING SERVICES</p>
        <h2>Sneaker cleaning pricing.</h2>
        <p>Two levels of care. The same attention to detail.</p>
        <span className="services-page-turnaround-badge">
          <Clock size={13} aria-hidden="true" />
          72-hour turnaround
        </span>
      </div>
      <div className="services-page-grid">
        {CLEANING_PLANS.map((plan) => (
          <div className="services-page-card" key={plan.label}>
            {plan.badge && <span className="services-page-badge">{plan.badge}</span>}
            <p className="services-page-card-label">{plan.label}</p>
            <div className="services-page-price">{plan.price}</div>
            <p className="services-page-price-note">{plan.priceNote}</p>
            <div className="services-page-rule" />
            <p className="services-page-desc">{plan.description}</p>
            <div className="services-page-checklist">
              {plan.checklist.map((item) => (
                <div className="services-page-check-item" key={item}>
                  <Check className="services-page-check-icon" size={16} aria-hidden="true" />
                  {item}
                </div>
              ))}
            </div>
            <Link className="landing-btn-primary" href={`/booking?service=${plan.serviceId}`}>
              {plan.cta}
              <ArrowIcon />
            </Link>
          </div>
        ))}
      </div>

      <div className="services-page-restoration-head">
        <p className="eyebrow-label">RESTORATION SERVICES</p>
        <p className="sub">Specialized care for a like-new look.</p>
        <span className="services-page-turnaround-badge">
          <Clock size={13} aria-hidden="true" />
          5&ndash;10 business day turnaround
        </span>
      </div>
      <div className="services-page-restoration-grid">
        {RESTORATION_SERVICES.map((service) => {
          const Icon = service.icon;
          return (
            <div className="services-page-restoration-card" key={service.title}>
              <div className="services-page-restoration-icon" aria-hidden="true">
                <Icon size={30} />
              </div>
              <p className="services-page-restoration-title">{service.title}</p>
              {service.price && (
                <p className="services-page-restoration-price">
                  Starting at <strong>{service.price}</strong>
                </p>
              )}
              <p className="services-page-restoration-desc">{service.description}</p>
              {service.subitems && (
                <>
                  <div className="services-page-restoration-rule" />
                  <div className="services-page-restoration-subgrid">
                    {service.subitems.map((sub) => (
                      <div key={sub.label}>
                        <p className="services-page-restoration-subitem-label">{sub.label}</p>
                        <p className="services-page-restoration-subitem-price">{sub.price}</p>
                        <p className="services-page-restoration-subitem-caption">Price depends on level of yellowing</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="landing-about-cta">
        <div>
          <p className="landing-eyebrow">READY TO RESTORE?</p>
          <h2>Give Your Sneakers a Second Life.</h2>
          <p>Book a restoration today and let&rsquo;s bring back the feeling.</p>
          <BookRestorationCta />
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
            <div className="landing-about-cta-tagline-rule-bottom" />
          </div>
        </div>
      </div>

      <SiteFooter active="services" />
      <MobileBookBar />
      <MobileTabBar />
    </div>
  );
}
