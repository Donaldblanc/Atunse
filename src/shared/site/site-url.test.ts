import { describe, expect, it } from "vitest";
import { isIndexable, siteUrl } from "./site-url";

describe("siteUrl", () => {
  it("prefers SITE_URL and drops a trailing slash", () => {
    expect(siteUrl({ SITE_URL: "https://atunse.com/", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" })).toBe("https://atunse.com");
  });
  it("falls back to Vercel's production hostname, then localhost", () => {
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "atunse-five.vercel.app" })).toBe("https://atunse-five.vercel.app");
    expect(siteUrl({})).toBe("http://localhost:3000");
  });
});

describe("isIndexable", () => {
  it("is true only for the production deployment", () => {
    expect(isIndexable({ VERCEL_ENV: "production" })).toBe(true);
    expect(isIndexable({ VERCEL_ENV: "preview", NODE_ENV: "production" })).toBe(false);
    expect(isIndexable({ NODE_ENV: "development" })).toBe(false);
  });
});
