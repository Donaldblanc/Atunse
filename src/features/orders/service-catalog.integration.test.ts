// The services and bundles tables (Services & Pricing) are seeded by
// migration from service-catalog.ts, which booking still prices from.
// Until booking reads the tables (docs/adr/0016), this proves the two
// agree, so a price changed in one place can't go unnoticed.
// Requires DATABASE_URL; run with `npm run test:integration`.

import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { BOOKING_ADD_ONS, BOOKING_SERVICES } from "@/features/booking/services-data";
import { BUNDLE_CATALOG, SERVICE_CATALOG } from "./service-catalog";

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe("service catalog parity (integration)", () => {
  it("has every catalog Service in the services table, same prices and rules, in catalog order", async () => {
    const rows = await prisma.service.findMany({ orderBy: { position: "asc" } });

    expect(
      rows.map(({ id, name, isCleaningTier, isAddOn, baseCents, isMinimum, suedeFee, minimumLabel, alsoFrom }) => ({
        id,
        name,
        isCleaningTier,
        isAddOn,
        baseCents,
        isMinimum,
        suedeFee,
        minimumLabel: minimumLabel ?? undefined,
        alsoFrom: alsoFrom ?? undefined,
      })),
    ).toEqual(SERVICE_CATALOG.map((service) => ({ ...service, minimumLabel: service.minimumLabel, alsoFrom: service.alsoFrom })));
    expect(rows.every((row) => row.active)).toBe(true);
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
