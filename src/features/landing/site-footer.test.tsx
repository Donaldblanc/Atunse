import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteFooter } from "./site-footer";

afterEach(() => vi.unstubAllEnvs());

describe("SiteFooter Copyright link", () => {
  it("is hidden when no Designated Agent is configured", () => {
    vi.stubEnv("DMCA_AGENT_NAME", "");
    expect(renderToStaticMarkup(<SiteFooter />)).not.toContain('href="/copyright"');
  });

  it("shows once the Designated Agent is configured", () => {
    vi.stubEnv("DMCA_AGENT_NAME", "Jane Doe");
    vi.stubEnv("DMCA_AGENT_ADDRESS", "1 Main St");
    vi.stubEnv("DMCA_AGENT_EMAIL", "dmca@example.com");
    expect(renderToStaticMarkup(<SiteFooter />)).toContain('href="/copyright"');
  });
});
