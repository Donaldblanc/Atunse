import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { pageMetadata } from "@/shared/site/page-metadata";
import "@/styles/landing-theme.css";
import { SiteNav } from "@/features/landing/site-nav";
import { SiteFooter } from "@/features/landing/site-footer";
import { MobileTabBar } from "@/features/landing/mobile-tabbar";
import { MobileBookBar } from "@/features/landing/mobile-book-bar";
import { FaqAccordion } from "@/features/landing/faq-accordion";
import { getGalleryImageUrl } from "@/features/landing/gallery";
import { hasContactDetails, loadBusinessProfile } from "@/features/landing/business-profile";
import { loadSiteSettings } from "@/features/settings/site-settings";
import { ContactSection } from "@/features/contact/contact-section";
import { CONTACT_FAQ_IMAGE, CONTACT_FAQS, CONTACT_HERO_IMAGE } from "@/features/contact/contact-content";

export const metadata = pageMetadata({
  title: "Contact — Atunṣe",
  description:
    "Questions about a booking, a custom job or anything else? Send RestoredByDJ a message and we'll get back to you.",
  path: "/contact",
});

// /contact?topic=booking (or general, custom, other) opens the form on
// that topic, for links from emails and other pages.
// A safety net: an admin save revalidates the site at once; this catches anything that changed another way.
export const revalidate = 3600;

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string | string[] }> }) {
  const { topic } = await searchParams;
  const profile = await loadBusinessProfile(loadSiteSettings);

  return (
    <div className="landing" id="landing-root">
      <SiteNav active="contact" />

      <main id="main-content" tabIndex={-1} className="contact-page">
        <section className="contact-hero">
          <div className="contact-hero-visual" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- external/S3-resolved URL, not a static import next/image can optimize */}
            <img src={getGalleryImageUrl(CONTACT_HERO_IMAGE.key)} alt="" width={529} height={343} />
          </div>
          <div className="contact-hero-copy">
            <p className="landing-eyebrow">CONTACT US</p>
            <h1 className="contact-h1">
              We&rsquo;re here to keep your sneakers <span>in rotation.</span>
            </h1>
            <p className="landing-lede">
              Have a question about a restoration, your booking, or a custom request? Send us a message and we&rsquo;ll get back to you
              as soon as possible.
            </p>
            {hasContactDetails(profile) && (
              <p className="landing-lede contact-hero-profile">
                {[profile.name, profile.location].filter(Boolean).join(" · ")}
                {profile.email && (
                  <>
                    {" · "}
                    <a href={`mailto:${profile.email}`}>{profile.email}</a>
                  </>
                )}
                {profile.phone && (
                  <>
                    {" · "}
                    <a href={`tel:${profile.phone.replace(/[^\d+]/g, "")}`}>{profile.phone}</a>
                  </>
                )}
              </p>
            )}
          </div>
          <div className="landing-about-cta-tagline contact-hero-tagline" aria-hidden="true">
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
        </section>

        <ContactSection initialTopic={typeof topic === "string" ? topic : null} />

        <section className="contact-faq">
          {/* eslint-disable-next-line @next/next/no-img-element -- external/S3-resolved URL, not a static import next/image can optimize */}
          <img
            className="contact-faq-photo"
            src={getGalleryImageUrl(CONTACT_FAQ_IMAGE.key)}
            alt={CONTACT_FAQ_IMAGE.alt}
            width={542}
            height={342}
            loading="lazy"
          />
          <div className="contact-faq-body">
            <FaqAccordion faqs={CONTACT_FAQS} title="Common questions" subtitle="Quick answers to help you get started." />
            <Link className="landing-link-arrow contact-faq-more" href="/#faq">
              View all FAQs
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter active="contact" />
      <MobileBookBar />
      <MobileTabBar />
    </div>
  );
}
