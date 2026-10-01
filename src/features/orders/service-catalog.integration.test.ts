// The services and bundles tables (Services & Pricing) are seeded by
// migration from service-catalog.ts, which booking still prices from.
// Until booking reads the tables (docs/adr/0016), this proves the two
// agree, so a price changed in one place can't go unnoticed.
// Requires TEST_DATABASE_URL; run with `npm run test:integration`.

import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { BOOKING_ADD_ONS, BOOKING_SERVICES } from "@/features/booking/services-data";
import { BUNDLE_CATALOG, SERVICE_CATALOG, SUEDE_FEE_CENTS } from "./service-catalog";

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe("service catalog parity (integration)", () => {
  it("has every catalog Service in the services table, same prices and rules, in catalog order", async () => {
    const rows = await prisma.service.findMany({ orderBy: { position: "asc" } });

    expect(
      rows.map(({ id, name, isCleaningTier, isAddOn, baseCents, isMinimum, suedeFeeCents, minimumLabel, alsoFrom }) => ({
        id,
        name,
        isCleaningTier,
        isAddOn,
        baseCents,
        isMinimum,
        // The code catalog has one flat Suede Fee; the table stores it per Service.
        suedeFee: suedeFeeCents === SUEDE_FEE_CENTS ? true : suedeFeeCents === 0 ? false : suedeFeeCents,
        minimumLabel: minimumLabel ?? undefined,
        alsoFrom: alsoFrom ?? undefined,
      })),
    ).toEqual(SERVICE_CATALOG);
    expect(rows.every((row) => row.active)).toBe(true);
  });

  it("files each Service under the category the booking flow shows it in", async () => {
    const rows = await prisma.service.findMany();
    const category = Object.fromEntries(rows.map((row) => [row.id, row.category]));
    const expected: Record<string, string> = { cleaning: "CLEANING", restoration: "RESTORATION", "custom-work": "CUSTOM_WORK" };

    for (const service of BOOKING_SERVICES) expect(category[service.id]).toBe(expected[service.category]);
    for (const addOn of BOOKING_ADD_ONS) expect(category[addOn.id]).toBe("ADDITIONAL");
  });

  it("carries the booking flow's description for each Service", async () => {
    const rows = await prisma.service.findMany();
    const descriptions = Object.fromEntries([...BOOKING_SERVICES, ...BOOKING_ADD_ONS].map((s) => [s.id, s.description]));

    expect(Object.fromEntries(rows.map((row) => [row.id, row.description]))).toEqual(descriptions);
  });

  it("has every Bundle in the bundles table, same price and perks", async () => {
    const rows = await prisma.bundle.findMany({ orderBy: { position: "asc" } });

    expect(rows.map(({ id, name, priceCents, perks }) => ({ id, name, priceCents, perks }))).toEqual(BUNDLE_CATALOG);
  });
});
