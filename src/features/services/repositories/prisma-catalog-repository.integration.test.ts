// Proves the CatalogRepository seam against a REAL Postgres — not mocked.
// Requires TEST_DATABASE_URL (see .env.example); run with `npm run test:integration`.
// Uses its own uniquely-prefixed ids so it never touches the seeded catalog.

import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { BundleIdTakenError, CatalogChangedError, CatalogImageKeyTakenError, MAX_CATALOG_IMAGES, TooManyCatalogImagesError, CatalogImageNotFoundError } from "./catalog-repository";
import { PrismaCatalogRepository } from "./prisma-catalog-repository";

const prisma = new PrismaClient();
const repo = new PrismaCatalogRepository(prisma);

const TEST_SERVICE_ID = "it_test_service";
const TEST_BUNDLE_ID = "it_test_bundle";

async function cleanup() {
  await prisma.serviceImage.deleteMany({ where: { serviceId: TEST_SERVICE_ID } });
  await prisma.bundleImage.deleteMany({ where: { bundleId: TEST_BUNDLE_ID } });
  await prisma.service.deleteMany({ where: { id: TEST_SERVICE_ID } });
  await prisma.bundle.deleteMany({ where: { id: TEST_BUNDLE_ID } });
}

beforeAll(cleanup);
afterEach(cleanup);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("PrismaCatalogRepository (integration)", () => {
  it("creates, updates and deactivates a Service", async () => {
    await prisma.service.create({
      data: {
        id: TEST_SERVICE_ID,
        name: "Integration Service",
        description: "A service made by the integration test.",
        category: "CLEANING",
        isCleaningTier: false,
        isAddOn: false,
        baseCents: 1000,
        isMinimum: false,
        suedeFeeCents: 0,
        active: true,
        position: 999,
      },
    });

    const updated = await repo.updateService(TEST_SERVICE_ID, { name: "Renamed Service", baseCents: 1500, active: false });
    expect(updated?.name).toBe("Renamed Service");
    expect(updated?.baseCents).toBe(1500);
    expect(updated?.active).toBe(false);

    const fetched = await repo.getService(TEST_SERVICE_ID);
    expect(fetched?.name).toBe("Renamed Service");
  });

  it("returns null updating a Service that doesn't exist", async () => {
    expect(await repo.updateService("no_such_service", { name: "x" })).toBeNull();
  });

  it("adds and removes Service images, up to the 5-image cap", async () => {
    await prisma.service.create({
      data: { id: TEST_SERVICE_ID, name: "Integration Service", description: "x", category: "CLEANING", isCleaningTier: false, isAddOn: false, baseCents: 1000, isMinimum: false, suedeFeeCents: 0, active: true, position: 999 },
    });

    for (let i = 0; i < MAX_CATALOG_IMAGES; i++) {
      await repo.addServiceImage(TEST_SERVICE_ID, `services/${TEST_SERVICE_ID}/${i}.jpg`);
    }
    await expect(repo.addServiceImage(TEST_SERVICE_ID, `services/${TEST_SERVICE_ID}/extra.jpg`)).rejects.toThrow(TooManyCatalogImagesError);

    const withImages = await repo.getService(TEST_SERVICE_ID);
    expect(withImages?.images).toHaveLength(MAX_CATALOG_IMAGES);

    const imageId = withImages!.images[0]!.id;
    const afterRemove = await repo.removeServiceImage(TEST_SERVICE_ID, imageId);
    expect(afterRemove?.images).toHaveLength(MAX_CATALOG_IMAGES - 1);

    await expect(repo.removeServiceImage(TEST_SERVICE_ID, imageId)).rejects.toThrow(CatalogImageNotFoundError);
  });

  it("creates a Bundle and updates it", async () => {
    const bundle = await repo.createBundle({ id: TEST_BUNDLE_ID, name: "Integration Bundle", priceCents: 5000, perks: ["Perk one"], position: 999 });
    expect(bundle.active).toBe(true);

    const updated = await repo.updateBundle(TEST_BUNDLE_ID, { priceCents: 6000, active: false });
    expect(updated?.priceCents).toBe(6000);
    expect(updated?.active).toBe(false);
  });

  it("adds and removes Bundle images", async () => {
    await repo.createBundle({ id: TEST_BUNDLE_ID, name: "Integration Bundle", priceCents: 5000, perks: [], position: 999 });

    const withImage = await repo.addBundleImage(TEST_BUNDLE_ID, `bundles/${TEST_BUNDLE_ID}/0.jpg`);
    expect(withImage?.images).toHaveLength(1);

    const imageId = withImage!.images[0]!.id;
    const afterRemove = await repo.removeBundleImage(TEST_BUNDLE_ID, imageId);
    expect(afterRemove?.images).toHaveLength(0);
  });

  it("rejects a second create of the same Bundle id with BundleIdTakenError", async () => {
    await repo.createBundle({ id: TEST_BUNDLE_ID, name: "Integration Bundle", priceCents: 5000, perks: [], position: 999 });
    await expect(repo.createBundle({ id: TEST_BUNDLE_ID, name: "Again", priceCents: 1, perks: [], position: 1000 })).rejects.toThrow(BundleIdTakenError);
  });

  it("rejects a duplicate image key with CatalogImageKeyTakenError", async () => {
    await repo.createBundle({ id: TEST_BUNDLE_ID, name: "Integration Bundle", priceCents: 5000, perks: [], position: 999 });
    const key = `bundles/${TEST_BUNDLE_ID}/dup.jpg`;
    await repo.addBundleImage(TEST_BUNDLE_ID, key);
    await expect(repo.addBundleImage(TEST_BUNDLE_ID, key)).rejects.toThrow(CatalogImageKeyTakenError);
  });

  it("refuses a stale Bundle update (expectedUpdatedAt) and applies a fresh one", async () => {
    const created = await repo.createBundle({ id: TEST_BUNDLE_ID, name: "Integration Bundle", priceCents: 5000, perks: [], position: 999 });

    const first = await repo.updateBundle(TEST_BUNDLE_ID, { priceCents: 6000 }, created.updatedAt);
    expect(first?.priceCents).toBe(6000);
    expect(first!.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());

    // The same (now stale) timestamp again: someone else saved in between.
    await expect(repo.updateBundle(TEST_BUNDLE_ID, { priceCents: 7000 }, new Date(created.updatedAt.getTime() - 1000))).rejects.toThrow(CatalogChangedError);
    expect((await repo.getBundle(TEST_BUNDLE_ID))?.priceCents).toBe(6000);
    expect(await repo.updateBundle("no_such_bundle", { priceCents: 1 }, created.updatedAt)).toBeNull();
  });

  it("refuses a stale Service update (expectedUpdatedAt)", async () => {
    const row = await prisma.service.create({
      data: { id: TEST_SERVICE_ID, name: "Integration Service", description: "x", category: "CLEANING", isCleaningTier: false, isAddOn: false, baseCents: 1000, isMinimum: false, suedeFeeCents: 0, active: true, position: 999 },
    });
    await expect(repo.updateService(TEST_SERVICE_ID, { baseCents: 2000 }, new Date(row.updatedAt.getTime() - 1000))).rejects.toThrow(CatalogChangedError);
    const ok = await repo.updateService(TEST_SERVICE_ID, { baseCents: 2000 }, row.updatedAt);
    expect(ok?.baseCents).toBe(2000);
  });
});
