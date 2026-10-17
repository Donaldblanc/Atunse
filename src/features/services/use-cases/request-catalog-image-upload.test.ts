import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { InMemoryFileStorage } from "@/shared/storage/in-memory-file-storage";
import { requestBundleImageUpload, requestServiceImageUpload } from "./request-catalog-image-upload";
import { CatalogValidationError } from "./update-catalog-item";
import { ADMIN, CUSTOMER } from "./test-fixtures";

describe("requestServiceImageUpload", () => {
  it("rejects a non-admin", async () => {
    const storage = new InMemoryFileStorage();
    await expect(requestServiceImageUpload({ storage }, CUSTOMER, { serviceId: "standard", contentType: "image/jpeg", size: 100 })).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("rejects a non-image content type", async () => {
    const storage = new InMemoryFileStorage();
    await expect(requestServiceImageUpload({ storage }, ADMIN, { serviceId: "standard", contentType: "application/pdf", size: 100 })).rejects.toThrow(
      CatalogValidationError,
    );
  });

  it("mints a key under services/<id>/ and an upload target", async () => {
    const storage = new InMemoryFileStorage();

    const upload = await requestServiceImageUpload({ storage }, ADMIN, { serviceId: "standard", contentType: "image/jpeg", size: 100 });

    expect(upload.key).toMatch(/^services\/standard\/.+\.jpg$/);
    expect(upload.url).toBe("https://storage.test/upload");
    expect(storage.issuedTargets).toHaveLength(1);
  });
});

describe("requestBundleImageUpload", () => {
  it("mints a key under bundles/<id>/", async () => {
    const storage = new InMemoryFileStorage();

    const upload = await requestBundleImageUpload({ storage }, ADMIN, { bundleId: "revival", contentType: "image/png", size: 100 });

    expect(upload.key).toMatch(/^bundles\/revival\/.+\.png$/);
  });
});
