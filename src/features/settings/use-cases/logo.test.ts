import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { InMemoryFileStorage } from "@/shared/storage/in-memory-file-storage";
import { InMemorySettingsRepository } from "../repositories/in-memory-settings-repository";
import { DEFAULT_BUSINESS_SETTINGS, defaultOperatingHours } from "../repositories/settings-repository";
import { InvalidLogoUploadError, LOGO_KEY_PREFIX, requestLogoUpload } from "./request-logo-upload";
import { removeLogo } from "./remove-logo";
import { setLogo } from "./set-logo";

const admin = { accountId: "admin-1", role: "ADMIN" as const };
const LOGO_KEY = "business-logo/123e4567-e89b-42d3-a456-426614174000";
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
    await setLogo({ settings }, admin, LOGO_KEY);
    const business = await settings.getBusinessSettings();
    expect(business.logoKey).toBe(LOGO_KEY);
    expect(business.businessName).toBe("Atunṣe Sneaker Care");
  });

  it("setLogo rejects a key outside the business-logo/ prefix", async () => {
    const settings = new InMemorySettingsRepository();
    await expect(setLogo({ settings }, admin, "services/abc")).rejects.toThrow(InvalidLogoUploadError);
    await expect(setLogo({ settings }, admin, LOGO_KEY_PREFIX)).rejects.toThrow(InvalidLogoUploadError);
    for (const bad of ["business-logo/abc", "business-logo/../services/x", `${LOGO_KEY}/extra`, `${LOGO_KEY}.png`, `x/${LOGO_KEY}`, "business-logo/..", `${LOGO_KEY}\n`]) {
      await expect(setLogo({ settings }, admin, bad)).rejects.toThrow(InvalidLogoUploadError);
    }
    expect((await settings.getBusinessSettings()).logoKey).toBeNull();
  });

  it("removeLogo clears the key", async () => {
    const settings = new InMemorySettingsRepository({ settings: { ...DEFAULT_BUSINESS_SETTINGS, logoKey: LOGO_KEY }, hours: defaultOperatingHours() });
    await removeLogo({ settings }, admin);
    expect((await settings.getBusinessSettings()).logoKey).toBeNull();
  });

  it("both are admin-only", async () => {
    const settings = new InMemorySettingsRepository();
    await expect(setLogo({ settings }, customer, "k")).rejects.toThrow(UnauthorizedError);
    await expect(removeLogo({ settings }, customer)).rejects.toThrow(UnauthorizedError);
  });
});
