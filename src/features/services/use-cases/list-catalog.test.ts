import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { InMemoryCatalogRepository } from "../repositories/in-memory-catalog-repository";
import { listCatalog } from "./list-catalog";
import { ADMIN, CUSTOMER, makeBundle, makeService } from "./test-fixtures";

describe("listCatalog", () => {
  it("rejects a non-admin", async () => {
    const catalog = new InMemoryCatalogRepository();
    await expect(listCatalog({ catalog }, CUSTOMER)).rejects.toThrow(UnauthorizedError);
  });

  it("lists every Service and Bundle", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.services.set("standard", makeService());
    catalog.bundles.set("revival", makeBundle());

    const result = await listCatalog({ catalog }, ADMIN);

    expect(result.services).toHaveLength(1);
    expect(result.bundles).toHaveLength(1);
  });
});
