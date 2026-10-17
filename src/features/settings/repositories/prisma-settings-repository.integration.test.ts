// Proves the SettingsRepository against a REAL Postgres. Run with `npm run test:integration`.
//
// A migration seeds the one BusinessSettings/OperatingHours rows (see
// pickup-window.integration.test.ts, which depends on that seed staying
// put), so this test snapshots and restores them rather than deleting
// them outright.

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaSettingsRepository } from "./prisma-settings-repository";
import { saveSettings, type RawSettings } from "../use-cases/save-settings";
import { setLogo } from "../use-cases/set-logo";
import { removeLogo } from "../use-cases/remove-logo";
import { DEFAULT_BUSINESS_SETTINGS, defaultOperatingHours, type SaveSettingsInput } from "./settings-repository";

const prisma = new PrismaClient();
const repo = new PrismaSettingsRepository(prisma);

let seededBusinessSettings: Awaited<ReturnType<typeof prisma.businessSettings.findMany>>;
let seededOperatingHours: Awaited<ReturnType<typeof prisma.operatingHours.findMany>>;

async function restoreSeed(): Promise<void> {
  await prisma.businessSettings.deleteMany();
  await prisma.operatingHours.deleteMany();
  if (seededBusinessSettings.length > 0) await prisma.businessSettings.createMany({ data: seededBusinessSettings });
  if (seededOperatingHours.length > 0) await prisma.operatingHours.createMany({ data: seededOperatingHours });
}

beforeAll(async () => {
  seededBusinessSettings = await prisma.businessSettings.findMany();
  seededOperatingHours = await prisma.operatingHours.findMany();
});

beforeEach(async () => {
  await prisma.businessSettings.deleteMany();
  await prisma.operatingHours.deleteMany();
});

afterAll(async () => {
  await restoreSeed();
  await prisma.$disconnect();
});

const input: SaveSettingsInput = {
  businessName: "Atunṣe Sneaker Care",
  tagline: "Restore more than sneakers.",
  ownerName: "DJ",
  email: "owner@example.com",
  phone: "5551234567",
  addressLine1: "1 Main St",
  addressLine2: null,
  city: "Brooklyn",
  state: "NY",
  zip: "11201",
  timeZone: "America/New_York",
  currency: "USD",
  allowLocalDropOff: true,
  allowMailIn: false,
  hours: defaultOperatingHours().map((row) => (row.weekday === 1 ? { ...row, isOpen: true, opensAt: 540, closesAt: 1080 } : row)),
};

describe("PrismaSettingsRepository (integration)", () => {
  it("returns defaults before anything has been saved", async () => {
    expect(await repo.getBusinessSettings()).toEqual(DEFAULT_BUSINESS_SETTINGS);
    expect(await repo.getOperatingHours()).toEqual(defaultOperatingHours());
  });

  it("saves BusinessSettings and OperatingHours in one write, and reads them back", async () => {
    await repo.saveSettings(input);

    const business = await repo.getBusinessSettings();
    expect(business).toMatchObject({ businessName: input.businessName, city: "Brooklyn", allowMailIn: false, logoKey: null });

    const hours = await repo.getOperatingHours();
    expect(hours.find((row) => row.weekday === 1)).toEqual({ weekday: 1, isOpen: true, opensAt: 540, closesAt: 1080 });
    expect(hours.find((row) => row.weekday === 0)).toEqual({ weekday: 0, isOpen: false, opensAt: 480, closesAt: 1320 });
  });

  it("leaves logoKey untouched when the save omits it, and clears it when explicitly null", async () => {
    await repo.saveSettings({ ...input, logoKey: "business-logo/abc" });
    expect((await repo.getBusinessSettings()).logoKey).toBe("business-logo/abc");

    await repo.saveSettings(input); // logoKey omitted
    expect((await repo.getBusinessSettings()).logoKey).toBe("business-logo/abc");

    await repo.saveSettings({ ...input, logoKey: null });
    expect((await repo.getBusinessSettings()).logoKey).toBeNull();
  });

  it("a replay with the same values changes nothing extra", async () => {
    await repo.saveSettings(input);
    await repo.saveSettings(input);
    const business = await repo.getBusinessSettings();
    expect(business).toMatchObject({ businessName: input.businessName });
  });

  it("setLogoKey changes only the logo, creating the row if needed", async () => {
    await repo.setLogoKey("business-logo/first");
    expect(await repo.getBusinessSettings()).toEqual({ ...DEFAULT_BUSINESS_SETTINGS, logoKey: "business-logo/first" });

    await repo.saveSettings(input);
    await repo.setLogoKey("business-logo/second");
    expect(await repo.getBusinessSettings()).toMatchObject({ businessName: input.businessName, city: "Brooklyn", logoKey: "business-logo/second" });
    expect((await repo.getOperatingHours()).find((row) => row.weekday === 1)).toMatchObject({ isOpen: true, opensAt: 540 });

    await repo.setLogoKey(null);
    expect((await repo.getBusinessSettings()).logoKey).toBeNull();
  });

  it("setLogo and removeLogo go through the real repository", async () => {
    const admin = { accountId: "admin-1", role: "ADMIN" as const };
    await repo.saveSettings(input);
    await setLogo({ settings: repo }, admin, "business-logo/123e4567-e89b-42d3-a456-426614174000");
    expect(await repo.getBusinessSettings()).toMatchObject({ businessName: input.businessName, logoKey: "business-logo/123e4567-e89b-42d3-a456-426614174000" });
    await removeLogo({ settings: repo }, admin);
    expect(await repo.getBusinessSettings()).toMatchObject({ businessName: input.businessName, logoKey: null });
  });

  it("saveSettings with a closed day satisfies operating_hours_times_check", async () => {
    const admin = { accountId: "admin-1", role: "ADMIN" as const };
    const raw: RawSettings = {
      businessName: "Atunṣe",
      tagline: "",
      ownerName: "",
      email: "",
      phone: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      zip: "",
      timeZone: "America/New_York",
      currency: "USD",
      allowLocalDropOff: true,
      allowMailIn: true,
      // Monday open; every other day closed with blank (disabled-input) times.
      hours: defaultOperatingHours().map((row) =>
        row.weekday === 1 ? { weekday: 1, isOpen: true, opensAt: "09:00", closesAt: "17:00" } : { weekday: row.weekday, isOpen: false, opensAt: "", closesAt: "" },
      ),
    };
    expect(await saveSettings({ settings: repo }, admin, raw)).toEqual({ ok: true });
    const hours = await repo.getOperatingHours();
    expect(hours.find((row) => row.weekday === 1)).toEqual({ weekday: 1, isOpen: true, opensAt: 540, closesAt: 1020 });
    for (const row of hours.filter((h) => h.weekday !== 1)) {
      expect(row.isOpen).toBe(false);
      expect(row.opensAt).toBeLessThan(row.closesAt);
    }
  });
});
