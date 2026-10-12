import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { InMemoryFileStorage } from "@/shared/storage/in-memory-file-storage";
import { InMemorySettingsRepository } from "../repositories/in-memory-settings-repository";
import { DEFAULT_BUSINESS_SETTINGS, defaultOperatingHours } from "../repositories/settings-repository";
import { InvalidLogoUploadError, requestLogoUpload } from "./request-logo-upload";
import { removeLogo } from "./remove-logo";
import { setLogo } from "./set-logo";

const admin = { accountId: "admin-1", role: "ADMIN" as const };
const customer = { accountId: "c-1", role: "CUSTOMER" as const };

describe("requestLogoUpload", () => {
  it("is admin-only", async () => {
    const storage = new InMemoryFileStorage();
    await expect(requestLogoUpload({ storage }, customer, { contentType: "image/png", size: 100 })).rejects.toThrow(UnauthorizedError);
  });

  it("issues an upload target under a random business-logo/ key", async () => {
    const storage = new InMemoryFileStorage();
    const upload = await requestLogoUpload({ storage }, admin, { contentType: "image/png", size: 1000 });
    expect(upload.key).toMatch(/^business-logo\//);
    expect(storage.issuedTargets).toHaveLength(1);
  });

  it("rejects a disallowed content type", async () => {
    const storage = new InMemoryFileStorage();
    await expect(requestLogoUpload({ storage }, admin, { contentType: "application/pdf", size: 100 })).rejects.toThrow(InvalidLogoUploadError);
  });

  it("rejects an oversized file", async () => {
    const storage = new InMemoryFileStorage();
    await expect(requestLogoUpload({ storage }, admin, { contentType: "image/png", size: 10 * 1024 * 1024 })).rejects.toThrow(InvalidLogoUploadError);
  });
});

describe("setLogo and removeLogo", () => {
  it("setLogo stores the key without touching other fields", async () => {
    const settings = new InMemorySettingsRepository({ settings: { ...DEFAULT_BUSINESS_SETTINGS, businessName: "Atunṣe Sneaker Care" }, hours: defaultOperatingHours() });
    await setLogo({ settings }, admin, "business-logo/abc");
    const business = await settings.getBusinessSettings();
    expect(business.logoKey).toBe("business-logo/abc");
    expect(business.businessName).toBe("Atunṣe Sneaker Care");
  });

  it("removeLogo clears the key", async () => {
    const settings = new InMemorySettingsRepository({ settings: { ...DEFAULT_BUSINESS_SETTINGS, logoKey: "business-logo/abc" }, hours: defaultOperatingHours() });
    await removeLogo({ settings }, admin);
    expect((await settings.getBusinessSettings()).logoKey).toBeNull();
  });

  it("both are admin-only", async () => {
    const settings = new InMemorySettingsRepository();
    await expect(setLogo({ settings }, customer, "k")).rejects.toThrow(UnauthorizedError);
    await expect(removeLogo({ settings }, customer)).rejects.toThrow(UnauthorizedError);
  });
});
