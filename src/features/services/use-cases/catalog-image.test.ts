import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { BundleNotFoundError, CatalogImageKeyTakenError, ServiceNotFoundError, TooManyCatalogImagesError, MAX_CATALOG_IMAGES } from "../repositories/catalog-repository";
import { InMemoryCatalogRepository } from "../repositories/in-memory-catalog-repository";
import { CatalogValidationError } from "./update-catalog-item";
import { addBundleImage, addServiceImage, removeServiceImage } from "./catalog-image";
import { ADMIN, CUSTOMER, makeBundle, makeService } from "./test-fixtures";

describe("addServiceImage", () => {
  it("rejects a non-admin", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.services.set("standard", makeService());
    await expect(addServiceImage({ catalog }, CUSTOMER, "standard", "services/standard/a.jpg")).rejects.toThrow(UnauthorizedError);
  });

  it("throws for a Service that doesn't exist", async () => {
    const catalog = new InMemoryCatalogRepository();
    await expect(addServiceImage({ catalog }, ADMIN, "missing", "services/missing/a.jpg")).rejects.toThrow(ServiceNotFoundError);
  });

  it("adds the image at the next position", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.services.set("standard", makeService());

    const updated = await addServiceImage({ catalog }, ADMIN, "standard", "services/standard/a.jpg");

    expect(updated.images).toHaveLength(1);
    expect(updated.images.at(0)?.key).toBe("services/standard/a.jpg");
  });

  it("refuses past the 5-image cap", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.services.set("standard", makeService());
    for (let i = 0; i < MAX_CATALOG_IMAGES; i++) {
      await addServiceImage({ catalog }, ADMIN, "standard", `services/standard/${i}.jpg`);
    }
    await expect(addServiceImage({ catalog }, ADMIN, "standard", "services/standard/extra.jpg")).rejects.toThrow(TooManyCatalogImagesError);
  });
});

describe("image key checks", () => {
  it("rejects a key outside the service's own prefix", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.services.set("standard", makeService());
    await expect(addServiceImage({ catalog }, ADMIN, "standard", "orders/abc/photo.jpg")).rejects.toThrow(CatalogValidationError);
    await expect(addServiceImage({ catalog }, ADMIN, "standard", "services/other/a.jpg")).rejects.toThrow(CatalogValidationError);
  });

  it("rejects a bundle key outside the bundle's prefix, and accepts one inside", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.bundles.set("revival", makeBundle());
    await expect(addBundleImage({ catalog }, ADMIN, "revival", "services/revival/a.jpg")).rejects.toThrow(CatalogValidationError);
    const updated = await addBundleImage({ catalog }, ADMIN, "revival", "bundles/revival/a.jpg");
    expect(updated.images).toHaveLength(1);
    await expect(addBundleImage({ catalog }, ADMIN, "missing", "bundles/missing/a.jpg")).rejects.toThrow(BundleNotFoundError);
  });

  it("maps a duplicate key to CatalogImageKeyTakenError", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.services.set("standard", makeService());
    await addServiceImage({ catalog }, ADMIN, "standard", "services/standard/a.jpg");
    await expect(addServiceImage({ catalog }, ADMIN, "standard", "services/standard/a.jpg")).rejects.toThrow(CatalogImageKeyTakenError);
  });
});

describe("removeServiceImage", () => {
  it("removes an existing image", async () => {
    const catalog = new InMemoryCatalogRepository();
    catalog.services.set("standard", makeService());
    const withImage = await addServiceImage({ catalog }, ADMIN, "standard", "services/standard/a.jpg");
    const imageId = withImage.images.at(0)?.id;
    if (!imageId) throw new Error("expected an image id");

    const updated = await removeServiceImage({ catalog }, ADMIN, "standard", imageId);

    expect(updated.images).toHaveLength(0);
  });
});
