import Link from "next/link";
import "@/styles/landing-theme.css";
import { SiteNav } from "@/features/landing/site-nav";
import { SiteFooter } from "@/features/landing/site-footer";
import { MobileTabBar } from "@/features/landing/mobile-tabbar";
import { MobileBookBar } from "@/features/landing/mobile-book-bar";
import { ArrowIcon } from "@/features/landing/arrow-icon";
import { getGalleryImageUrl } from "@/features/landing/gallery";
import { PROCESS_HERO_IMAGE, PROCESS_STEPS } from "@/features/landing/process";

export const metadata = {
  title: "Our Process — Atunṣe",
};

export default function ProcessPage() {
  return (
    <div className="landing" id="landing-root">
      <SiteNav active="process" />

      <main className="process-page">
        <section className="process-hero">
          <div className="process-hero-visual" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- external/S3-resolved URL, not a static import next/image can optimize */}
            <img src={getGalleryImageUrl(PROCESS_HERO_IMAGE.key)} alt="" width={746} height={292} />
          </div>
          <div className="process-hero-copy">
            <p className="process-eyebrow">Our Process</p>
            <h1 className="process-h1">
              Premium Care,
              <span>From Your Door to On Feet.</span>
            </h1>
            <p className="process-lede">
              A simple, seamless process to get your sneakers looking their best. Book online, choose a
              Local Drop-Off or mail in your pair, and let our experts handle the rest.
            </p>
          </div>
        </section>

        <ol className="process-steps">
          {PROCESS_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li className="process-step" key={step.title}>
                <span className="process-step-icon" aria-hidden="true">
                  <Icon size={26} strokeWidth={1.6} />
                </span>
                <span className="process-step-num">{String(index + 1).padStart(2, "0")}</span>
                <h2 className="process-step-title">{step.title}</h2>
                <p className="process-step-desc">{step.description}</p>
                {/* eslint-disable-next-line @next/next/no-img-element -- external/S3-resolved URL, not a static import next/image can optimize */}
                <img
                  className="process-step-photo"
                  src={getGalleryImageUrl(step.image.key)}
                  alt={step.image.alt}
                  width={336}
                  height={274}
                  loading="lazy"
                />
              </li>
            );
          })}
        </ol>

        <div className="process-cta">
          <Link className="landing-btn-primary" href="/booking">
            Book Your Service
            <ArrowIcon />
          </Link>
          <p className="process-tagline">Clean sneakers. A longer tomorrow.</p>
        </div>
      </main>

      <SiteFooter active="process" />
      <MobileBookBar />
      <MobileTabBar />
    </div>
  );
}
