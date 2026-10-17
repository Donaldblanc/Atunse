import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { BundleIdTakenError } from "../repositories/catalog-repository";
import { InMemoryCatalogRepository } from "../repositories/in-memory-catalog-repository";
import { createBundle } from "./create-bundle";
import { CatalogValidationError } from "./update-catalog-item";
import { ADMIN, CUSTOMER, makeBundle } from "./test-fixtures";

describe("createBundle", () => {
  it("rejects a non-admin", async () => {
    const catalog = new InMemoryCatalogRepository();
    await expect(createBundle({ catalog }, CUSTOMER, { name: "New Pack", priceCents: 1000, perks: [] })).rejects.toThrow(UnauthorizedError);
  });

  it("slugs the name into an id and appends after the last position", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.bundles.set("revival", makeBundle({ id: "revival", position: 0 }));

    const bundle = await createBundle({ catalog }, ADMIN, { name: "The Collector's Triple", priceCents: 20000, perks: ["Perk"] });

    expect(bundle.id).toBe("the-collector-s-triple");
    expect(bundle.position).toBe(1);
    expect(bundle.active).toBe(true);
  });

  it("refuses a duplicate id", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.bundles.set("revival", makeBundle({ id: "revival" }));

    await expect(createBundle({ catalog }, ADMIN, { name: "Revival", priceCents: 1000, perks: [] })).rejects.toThrow(BundleIdTakenError);
  });

  it("rejects an empty name", async () => {
    const catalog = new InMemoryCatalogRepository();
    await expect(createBundle({ catalog }, ADMIN, { name: "   ", priceCents: 1000, perks: [] })).rejects.toThrow(CatalogValidationError);
  });
});
