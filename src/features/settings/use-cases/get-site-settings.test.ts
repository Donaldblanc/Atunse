import { describe, expect, it } from "vitest";
import { InMemorySettingsRepository } from "../repositories/in-memory-settings-repository";
import { DEFAULT_BUSINESS_SETTINGS } from "../repositories/settings-repository";
import { getSiteSettings } from "./get-site-settings";

describe("getSiteSettings", () => {
  it("is a public read: no acting user, and only what the customer site shows", async () => {
    const settings = new InMemorySettingsRepository({
      settings: { ...DEFAULT_BUSINESS_SETTINGS, ownerName: "DJ Owner", logoKey: "business-logo/abc", email: "hi@example.com", city: "Newark", state: "NJ", allowMailIn: false },
      hours: [{ weekday: 1, isOpen: true, opensAt: 540, closesAt: 1020 }],
    });
    const site = await getSiteSettings({ settings });
    expect(site).toMatchObject({ businessName: "Atunṣe", email: "hi@example.com", city: "Newark", state: "NJ", allowLocalDropOff: true, allowMailIn: false });
    expect(site.hours).toHaveLength(7);
    expect(site.hours[1]).toEqual({ weekday: 1, isOpen: true, opensAt: 540, closesAt: 1020 });
    // Never the owner's name, the logo or anything about accounts.
    expect(site).not.toHaveProperty("ownerName");
    expect(site).not.toHaveProperty("logoKey");
    expect(JSON.stringify(site)).not.toContain("DJ Owner");
  });

  it("falls back to Settings' defaults before anything is saved", async () => {
    const site = await getSiteSettings({ settings: new InMemorySettingsRepository() });
    expect(site.allowLocalDropOff).toBe(true);
    expect(site.allowMailIn).toBe(true);
    expect(site.email).toBeNull();
  });
});
