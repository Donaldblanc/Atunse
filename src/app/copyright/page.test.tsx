import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/copyright",
}));

const { default: CopyrightPage } = await import("./page");

afterEach(() => vi.unstubAllEnvs());

describe("/copyright", () => {
  it("calls notFound when no Designated Agent is configured", () => {
    vi.stubEnv("DMCA_AGENT_NAME", "");
    vi.stubEnv("DMCA_AGENT_ADDRESS", "");
    vi.stubEnv("DMCA_AGENT_EMAIL", "");
    expect(() => CopyrightPage()).toThrow("NEXT_NOT_FOUND");
  });

  it("renders the policy and the agent block when configured", () => {
    vi.stubEnv("DMCA_AGENT_NAME", "Jane Doe");
    vi.stubEnv("DMCA_AGENT_ADDRESS", "1 Main St\\nNew York, NY 10001");
    vi.stubEnv("DMCA_AGENT_EMAIL", "dmca@example.com");
    vi.stubEnv("DMCA_REGISTRATION_NUMBER", "DMCA-1234567");
    const html = renderToStaticMarkup(CopyrightPage());
    expect(html).toContain("Copyright Policy");
    expect(html).toContain("512(c)(3)(A)");
    expect(html).toContain("512(g)(3)");
    expect(html).toContain("512(i)");
    expect(html).toContain("512(f)");
    expect(html).toContain("Jane Doe");
    expect(html).toContain("New York, NY 10001");
    expect(html).toContain("mailto:dmca@example.com");
    expect(html).toContain("DMCA-1234567");
    expect(html).toContain("This page is general information, not legal advice.");
  });
});
