import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { BundleNotFoundError, ServiceNotFoundError } from "../repositories/catalog-repository";
import { InMemoryCatalogRepository } from "../repositories/in-memory-catalog-repository";
import { setBundleActive, setServiceActive } from "./set-catalog-item-active";
import { ADMIN, CUSTOMER, makeBundle, makeService } from "./test-fixtures";

describe("setServiceActive", () => {
  it("rejects a non-admin", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.services.set("standard", makeService());
    await expect(setServiceActive({ catalog }, CUSTOMER, "standard", false)).rejects.toThrow(UnauthorizedError);
  });

  it("throws for a Service that doesn't exist", async () => {
    const catalog = new InMemoryCatalogRepository();
    await expect(setServiceActive({ catalog }, ADMIN, "missing", false)).rejects.toThrow(ServiceNotFoundError);
  });

  it("deactivates (Delete Service maps to this, never a real delete)", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.services.set("standard", makeService({ active: true }));

    const result = await setServiceActive({ catalog }, ADMIN, "standard", false);

    expect(result.status).toBe("updated");
    expect(result.record.active).toBe(false);
    expect(catalog.services.get("standard")).toBeDefined(); // still there, not deleted
  });

  it("a replay (already inactive) changes nothing further", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.services.set("standard", makeService({ active: false }));

    const result = await setServiceActive({ catalog }, ADMIN, "standard", false);

    expect(result.status).toBe("unchanged");
  });
});

describe("setBundleActive", () => {
  it("throws for a Bundle that doesn't exist", async () => {
    const catalog = new InMemoryCatalogRepository();
    await expect(setBundleActive({ catalog }, ADMIN, "missing", false)).rejects.toThrow(BundleNotFoundError);
  });

  it("deactivates", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.bundles.set("revival", makeBundle({ active: true }));

    const result = await setBundleActive({ catalog }, ADMIN, "revival", false);

    expect(result.status).toBe("updated");
    expect(result.record.active).toBe(false);
    expect(catalog.bundles.get("revival")).toBeDefined();
  });
});
