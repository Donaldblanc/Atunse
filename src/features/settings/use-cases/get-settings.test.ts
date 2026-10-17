import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { InMemoryFileStorage } from "@/shared/storage/in-memory-file-storage";
import { InMemorySettingsRepository } from "../repositories/in-memory-settings-repository";
import { DEFAULT_BUSINESS_SETTINGS } from "../repositories/settings-repository";
import { getSettings } from "./get-settings";

const admin = { accountId: "admin-1", role: "ADMIN" as const };
const customer = { accountId: "c-1", role: "CUSTOMER" as const };

describe("getSettings", () => {
  it("is admin-only", async () => {
    const settings = new InMemorySettingsRepository();
    const storage = new InMemoryFileStorage();
    await expect(getSettings({ settings, storage }, customer)).rejects.toThrow(UnauthorizedError);
  });

  it("returns defaults and no logo URL before anything is saved", async () => {
    const settings = new InMemorySettingsRepository();
    const storage = new InMemoryFileStorage();
    const result = await getSettings({ settings, storage }, admin);
    expect(result.business).toEqual(DEFAULT_BUSINESS_SETTINGS);
    expect(result.hours).toHaveLength(7);
    expect(result.logoUrl).toBeNull();
  });

  it("resolves a view URL once a logo is stored", async () => {
    const settings = new InMemorySettingsRepository({ settings: { ...DEFAULT_BUSINESS_SETTINGS, logoKey: "business-logo/abc" } });
    const storage = new InMemoryFileStorage();
    const result = await getSettings({ settings, storage }, admin);
    expect(result.logoUrl).toContain("business-logo/abc");
  });
});
