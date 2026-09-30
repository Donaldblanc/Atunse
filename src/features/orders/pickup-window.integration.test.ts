// Settings' Operating Hours are seeded from pickup-window.ts, which
// booking still uses. Until booking reads the table, this proves the two
// agree. Requires DATABASE_URL; run with `npm run test:integration`.

import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { PICKUP_WINDOW_MINUTES } from "./pickup-window";

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe("operating hours parity (integration)", () => {
  it("opens every weekday for the booking flow's collection window", async () => {
    const rows = await prisma.operatingHours.findMany({ orderBy: { weekday: "asc" } });

    expect(rows).toEqual([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, isOpen: true, ...PICKUP_WINDOW_MINUTES })));
  });

  it("holds exactly one row of business settings, in shop time", async () => {
    const rows = await prisma.businessSettings.findMany();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 1, timeZone: "America/New_York", currency: "USD", allowLocalDropOff: true, allowMailIn: true });
    await expect(prisma.businessSettings.create({ data: { id: 2, businessName: "x", timeZone: "UTC", currency: "USD" } })).rejects.toThrow();
  });

  it("refuses hours that close before they open, or a weekday that doesn't exist", async () => {
    await expect(prisma.operatingHours.update({ where: { weekday: 1 }, data: { closesAt: 400 } })).rejects.toThrow();
    await expect(prisma.operatingHours.create({ data: { weekday: 7, isOpen: true, opensAt: 480, closesAt: 1320 } })).rejects.toThrow();
  });
});
