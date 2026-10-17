import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { BundleNotFoundError, CatalogChangedError, ServiceNotFoundError } from "../repositories/catalog-repository";
import { InMemoryCatalogRepository } from "../repositories/in-memory-catalog-repository";
import { CatalogValidationError, updateBundle, updateService } from "./update-catalog-item";
import { ADMIN, CUSTOMER, makeBundle, makeService } from "./test-fixtures";

const LOADED = new Date("2026-01-01T00:00:00Z");

describe("updateService", () => {
  it("rejects a non-admin", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.services.set("standard", makeService());
    await expect(
      updateService(
        { catalog },
        CUSTOMER,
        { serviceId: "standard", name: "Standard Clean", description: "x", baseCents: 3000, suedeFeeCents: 1000, category: "CLEANING", active: true, internalNotes: null, expectedUpdatedAt: LOADED },
      ),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws for a Service that doesn't exist", async () => {
    const catalog = new InMemoryCatalogRepository();
    await expect(
      updateService(
        { catalog },
        ADMIN,
        { serviceId: "missing", name: "Name", description: "x", baseCents: 1, suedeFeeCents: 0, category: "CLEANING", active: true, internalNotes: null, expectedUpdatedAt: LOADED },
      ),
    ).rejects.toThrow(ServiceNotFoundError);
  });

  it("rejects an empty name", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.services.set("standard", makeService());
    await expect(
      updateService(
        { catalog },
        ADMIN,
        { serviceId: "standard", name: "  ", description: "x", baseCents: 1, suedeFeeCents: 0, category: "CLEANING", active: true, internalNotes: null, expectedUpdatedAt: LOADED },
      ),
    ).rejects.toThrow(CatalogValidationError);
  });

  it("rejects a negative price", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.services.set("standard", makeService());
    await expect(
      updateService(
        { catalog },
        ADMIN,
        { serviceId: "standard", name: "Standard Clean", description: "x", baseCents: -1, suedeFeeCents: 0, category: "CLEANING", active: true, internalNotes: null, expectedUpdatedAt: LOADED },
      ),
    ).rejects.toThrow(CatalogValidationError);
  });

  it("saves the whole record, trimmed", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.services.set("standard", makeService());

    const updated = await updateService(
      { catalog },
      ADMIN,
      { serviceId: "standard", name: " Standard Clean ", description: " Deep clean. ", baseCents: 3500, suedeFeeCents: 1200, category: "RESTORATION", active: false, internalNotes: " Popular. ", expectedUpdatedAt: LOADED },
    );

    expect(updated.name).toBe("Standard Clean");
    expect(updated.baseCents).toBe(3500);
    expect(updated.category).toBe("RESTORATION");
    expect(updated.active).toBe(false);
    expect(updated.internalNotes).toBe("Popular.");
  });

  it("refuses a stale form: a replay of the same save is rejected, not applied twice", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.services.set("standard", makeService());
    const input = { serviceId: "standard", name: "Standard Clean", description: "Deep clean.", baseCents: 3000, suedeFeeCents: 1000, category: "CLEANING" as const, active: true, internalNotes: null, expectedUpdatedAt: LOADED };

    await updateService({ catalog }, ADMIN, input);
    await expect(updateService({ catalog }, ADMIN, { ...input, baseCents: 9999 })).rejects.toThrow(CatalogChangedError);
    expect(catalog.services.get("standard")?.baseCents).toBe(3000);
  });
});

describe("updateBundle", () => {
  it("throws for a Bundle that doesn't exist", async () => {
    const catalog = new InMemoryCatalogRepository();
    await expect(
      updateBundle({ catalog }, ADMIN, { bundleId: "missing", name: "Name", priceCents: 1, perks: [], active: true, internalNotes: null, expectedUpdatedAt: LOADED }),
    ).rejects.toThrow(BundleNotFoundError);
  });

  it("saves the whole record, dropping blank perks", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.bundles.set("revival", makeBundle());

    const updated = await updateBundle(
      { catalog },
      ADMIN,
      { bundleId: "revival", name: "The Revival Pack", priceCents: 16000, perks: ["Perk one", "  ", "Perk two"], active: true, internalNotes: null, expectedUpdatedAt: LOADED },
    );

    expect(updated.priceCents).toBe(16000);
    expect(updated.perks).toEqual(["Perk one", "Perk two"]);
  });

  it("refuses a stale Bundle form", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.bundles.set("revival", makeBundle({ updatedAt: new Date("2026-02-01T00:00:00Z") }));
    await expect(
      updateBundle({ catalog }, ADMIN, { bundleId: "revival", name: "The Revival Pack", priceCents: 1, perks: [], active: true, internalNotes: null, expectedUpdatedAt: LOADED }),
    ).rejects.toThrow(CatalogChangedError);
    expect(catalog.bundles.get("revival")?.priceCents).toBe(15000);
  });
});
