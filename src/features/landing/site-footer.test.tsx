import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { businessProfile } from "./business-profile";
import { SiteFooterView } from "./site-footer";

afterEach(() => vi.unstubAllEnvs());

describe("SiteFooter Copyright link", () => {
  it("is hidden when no Designated Agent is configured", () => {
    vi.stubEnv("DMCA_AGENT_NAME", "");
    expect(renderToStaticMarkup(<SiteFooterView />)).not.toContain('href="/copyright"');
  });

  it("shows once the Designated Agent is configured", () => {
    vi.stubEnv("DMCA_AGENT_NAME", "Jane Doe");
    vi.stubEnv("DMCA_AGENT_ADDRESS", "1 Main St");
    vi.stubEnv("DMCA_AGENT_EMAIL", "dmca@example.com");
    expect(renderToStaticMarkup(<SiteFooterView />)).toContain('href="/copyright"');
  });
});

describe("SiteFooterView business profile", () => {
  it("falls back to today's text when Settings has nothing to add", () => {
    const html = renderToStaticMarkup(<SiteFooterView profile={businessProfile(null)} />);
    expect(html).toContain("Atunṣe");
    expect(html).toContain("RestoredByDJ · New York, NY");
    expect(html).not.toContain("mailto:");
  });

  it("shows the business name, location, email and phone when set", () => {
    const profile = businessProfile({ businessName: "Atunṣe Studio", city: "Newark", state: "NJ", email: "hi@example.com", phone: "(555) 010-1234" });
    const html = renderToStaticMarkup(<SiteFooterView profile={profile} />);
    expect(html).toContain("Atunṣe Studio");
    expect(html).toContain("RestoredByDJ · Newark, NJ");
    expect(html).toContain('href="mailto:hi@example.com"');
    expect(html).toContain('href="tel:5550101234"');
  });
});
