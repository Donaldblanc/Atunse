import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InMemorySettingsRepository } from "@/features/settings/repositories/in-memory-settings-repository";
import { DEFAULT_BUSINESS_SETTINGS, defaultOperatingHours } from "@/features/settings/repositories/settings-repository";
import { InMemoryFileStorage } from "@/shared/storage/in-memory-file-storage";
import { InMemoryAccounts } from "@/features/accounts/repositories/in-memory-repositories";

const admin = { accountId: "admin-1", role: "ADMIN" as const };

let settings: InMemorySettingsRepository;
let storage: InMemoryFileStorage;
let accounts: InMemoryAccounts;

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/features/accounts/acting-user", () => ({ actingUserFromCookies: async () => admin }));
vi.mock("@/features/settings/deps", () => ({ buildSettingsDeps: () => ({ settings, storage, accounts }) }));

const { default: AdminSettingsPage } = await import("./page");

describe("admin settings page (Business Profile tab)", () => {
  it("renders Business Information, Operating Hours, Booking Settings and the Settings tab strip", async () => {
    settings = new InMemorySettingsRepository({ settings: { ...DEFAULT_BUSINESS_SETTINGS, businessName: "Atunṣe Sneaker Care" }, hours: defaultOperatingHours() });
    storage = new InMemoryFileStorage();
    accounts = new InMemoryAccounts();
    accounts.add({ id: "admin-1", role: "ADMIN", email: "dj@atunse.com", name: "DJ" });

    const page = await AdminSettingsPage();
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Business Information");
    expect(html).toContain("Atunṣe Sneaker Care");
    expect(html).toContain("Operating Hours");
    expect(html).toContain("Booking Settings");
    expect(html).toContain("Business Logo");
    expect(html).toContain("Account Settings");
    expect(html).toContain("Integrations");
    expect(html).toContain("Not Connected");
    expect(html).toContain("Notifications");
    expect(html).toContain("Soon");
  });

  it("shows a logo preview once logoKey is set", async () => {
    settings = new InMemorySettingsRepository({ settings: { ...DEFAULT_BUSINESS_SETTINGS, logoKey: "business-logo/abc" }, hours: defaultOperatingHours() });
    storage = new InMemoryFileStorage();
    accounts = new InMemoryAccounts();
    accounts.add({ id: "admin-1", role: "ADMIN", email: "dj@atunse.com", name: "DJ" });

    const page = await AdminSettingsPage();
    const html = renderToStaticMarkup(page);
    expect(html).toContain("business-logo/abc");
  });
});
