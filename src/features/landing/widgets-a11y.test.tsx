import { describe, expect, it, vi } from "vitest";
import { a11yProblems, markup } from "@/shared/testing/a11y";

vi.mock("next/navigation", () => ({ usePathname: () => "/services" }));

const { ReviewsCarousel } = await import("./reviews-carousel");
const { FaqAccordion } = await import("./faq-accordion");
const { NavDrawer } = await import("./nav-drawer");
const { MobileTabBar } = await import("./mobile-tabbar");
const { ThemeToggle } = await import("./theme-toggle");
const { BrandMarquee } = await import("./brand-marquee");
const { BRAND_LOGOS } = await import("./brand-logos");

const reviews = [{ stars: 5, quote: "Great.", name: "A", loc: "NYC", initials: "A" }];

describe("landing widgets: accessible markup", () => {
  it("reviews carousel has a pause control and stays silent while rotating", () => {
    const el = <ReviewsCarousel reviews={reviews} />;
    const html = markup(el);
    expect(html).toContain('aria-label="Pause automatic review rotation"');
    expect(html).toContain('aria-live="off"');
    expect(a11yProblems(el)).toEqual([]);
  });

  it("faq accordion buttons expose aria-expanded", () => {
    const el = <FaqAccordion faqs={[{ question: "Q?", answer: "A." }]} />;
    expect(markup(el)).toContain('aria-expanded="false"');
    expect(a11yProblems(el)).toEqual([]);
  });

  it("nav drawer is a labelled modal dialog, inert while closed, and its trigger controls it", () => {
    const el = <NavDrawer />;
    const html = markup(el);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("inert");
    expect(a11yProblems(el)).toEqual([]);
  });

  it("tab bar marks the current page", () => {
    const html = markup(<MobileTabBar />);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("theme toggle is a labelled toggle button", () => {
    const el = <ThemeToggle />;
    expect(markup(el)).toContain('aria-pressed="false"');
    expect(a11yProblems(el)).toEqual([]);
  });

  it("brand marquee reads each brand once", () => {
    const el = <BrandMarquee />;
    // Both theme variants of every logo in the repeated copy are hidden.
    expect(markup(el).match(/aria-hidden="true"/g)).toHaveLength(BRAND_LOGOS.length);
    expect(a11yProblems(el)).toEqual([]);
  });
});
