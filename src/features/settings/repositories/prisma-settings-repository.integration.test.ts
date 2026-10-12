// Proves the SettingsRepository against a REAL Postgres. Run with `npm run test:integration`.
//
// A migration seeds the one BusinessSettings/OperatingHours rows (see
// pickup-window.integration.test.ts, which depends on that seed staying
// put), so this test snapshots and restores them rather than deleting
// them outright.

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaSettingsRepository } from "./prisma-settings-repository";
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
});
