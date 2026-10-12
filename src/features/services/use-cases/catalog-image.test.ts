import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { ServiceNotFoundError, TooManyCatalogImagesError, MAX_CATALOG_IMAGES } from "../repositories/catalog-repository";
import { InMemoryCatalogRepository } from "../repositories/in-memory-catalog-repository";
import { addServiceImage, removeServiceImage } from "./catalog-image";
import { ADMIN, CUSTOMER, makeService } from "./test-fixtures";

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
