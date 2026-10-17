import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { InMemorySettingsRepository } from "../repositories/in-memory-settings-repository";
import { defaultOperatingHours } from "../repositories/settings-repository";
import { cleanSettings, saveSettings, type RawSettings } from "./save-settings";

const admin = { accountId: "admin-1", role: "ADMIN" as const };
const customer = { accountId: "c-1", role: "CUSTOMER" as const };

function rawHours() {
  return defaultOperatingHours().map((row) => (row.weekday === 1 ? { weekday: 1, isOpen: true, opensAt: "08:00", closesAt: "18:00" } : { weekday: row.weekday, isOpen: false, opensAt: "08:00", closesAt: "18:00" }));
}

const VALID: RawSettings = {
  businessName: "Atunṣe",
  tagline: "",
  ownerName: "",
  email: "owner@example.com",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zip: "",
  timeZone: "America/New_York",
  currency: "usd",
  allowLocalDropOff: true,
  allowMailIn: true,
  hours: rawHours(),
};

describe("cleanSettings", () => {
  it("accepts a valid form, blanking optional fields to null and upper-casing currency", () => {
    const result = cleanSettings(VALID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.currency).toBe("USD");
      expect(result.input.tagline).toBeNull();
      expect(result.input.hours.find((h) => h.weekday === 1)).toEqual({ weekday: 1, isOpen: true, opensAt: 480, closesAt: 1080 });
    }
  });

  it("rejects a blank business name", () => {
    const result = cleanSettings({ ...VALID, businessName: "  " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.businessName).toBeTruthy();
  });

  it("rejects a bad currency code", () => {
    const result = cleanSettings({ ...VALID, currency: "US" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.currency).toBeTruthy();
  });

  it("rejects an open weekday with a close time before its open time", () => {
    const hours = rawHours().map((row) => (row.weekday === 1 ? { ...row, opensAt: "18:00", closesAt: "08:00" } : row));
    const result = cleanSettings({ ...VALID, hours });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["hours:1"]).toBeTruthy();
  });
});

describe("saveSettings", () => {
  it("is admin-only", async () => {
    const settings = new InMemorySettingsRepository();
    await expect(saveSettings({ settings }, customer, VALID)).rejects.toThrow(UnauthorizedError);
  });

  it("saves valid input and leaves logoKey untouched by default", async () => {
    const settings = new InMemorySettingsRepository();
    const result = await saveSettings({ settings }, admin, VALID);
    expect(result).toEqual({ ok: true });
    expect((await settings.getBusinessSettings()).currency).toBe("USD");
    expect((await settings.getBusinessSettings()).logoKey).toBeNull();
  });

  it("returns field errors without writing anything, on an invalid form", async () => {
    const settings = new InMemorySettingsRepository();
    const result = await saveSettings({ settings }, admin, { ...VALID, businessName: "" });
    expect(result.ok).toBe(false);
    expect((await settings.getBusinessSettings()).businessName).not.toBe("");
  });

  it("never writes a closed day's times as 0/0 (the database needs opensAt < closesAt)", async () => {
    const settings = new InMemorySettingsRepository();
    await saveSettings({ settings }, admin, VALID);
    for (const row of await settings.getOperatingHours()) expect(row.opensAt).toBeLessThan(row.closesAt);
  });
});

describe("cleanSettings closed days", () => {
  const closedWith = (opensAt: string, closesAt: string) => ({ ...VALID, hours: [{ weekday: 2, isOpen: false, opensAt, closesAt }] });
  const closedRow = (raw: RawSettings, stored?: Parameters<typeof cleanSettings>[1]) => {
    const result = cleanSettings(raw, stored);
    if (!result.ok) throw new Error("expected ok");
    return result.input.hours[0];
  };

  it("keeps valid posted times", () => {
    expect(closedRow(closedWith("09:00", "17:00"))).toEqual({ weekday: 2, isOpen: false, opensAt: 540, closesAt: 1020 });
  });

  it("falls back to the stored times when the posted ones are blank or backwards", () => {
    const stored = [{ weekday: 2, isOpen: false, opensAt: 600, closesAt: 900 }];
    expect(closedRow(closedWith("", ""), stored)).toMatchObject({ opensAt: 600, closesAt: 900 });
    expect(closedRow(closedWith("18:00", "08:00"), stored)).toMatchObject({ opensAt: 600, closesAt: 900 });
  });

  it("falls back to 08:00-22:00 with nothing stored", () => {
    expect(closedRow(closedWith("", ""), [])).toMatchObject({ opensAt: 480, closesAt: 1320 });
  });
});

describe("cleanSettings field checks", () => {
  const errorsFor = (patch: Partial<RawSettings>) => {
    const result = cleanSettings({ ...VALID, ...patch });
    return result.ok ? {} : result.errors;
  };

  it("checks email shape, phone, and time zone", () => {
    expect(errorsFor({ email: "a@b" }).email).toBeTruthy();
    expect(errorsFor({ email: "owner@example.com" }).email).toBeUndefined();
    expect(errorsFor({ phone: "abc" }).phone).toBeTruthy();
    expect(errorsFor({ phone: "123" }).phone).toBeTruthy();
    expect(errorsFor({ phone: "+1 (555) 123-4567" }).phone).toBeUndefined();
    expect(errorsFor({ timeZone: "Mars/Olympus" }).timeZone).toBeTruthy();
    expect(errorsFor({ timeZone: "America/Chicago" }).timeZone).toBeUndefined();
  });
});
