// Test double for the SettingsRepository seam (see the Prisma version).

import {
  DEFAULT_BUSINESS_SETTINGS,
  defaultOperatingHours,
  type BusinessSettingsData,
  type OperatingHoursRow,
  type SaveSettingsInput,
  type SettingsRepository,
} from "./settings-repository";

export class InMemorySettingsRepository implements SettingsRepository {
  private settings: BusinessSettingsData | null;
  private hours: Map<number, OperatingHoursRow>;

  constructor(seed?: { settings?: BusinessSettingsData; hours?: OperatingHoursRow[] }) {
    this.settings = seed?.settings ?? null;
    this.hours = new Map((seed?.hours ?? []).map((row) => [row.weekday, row]));
  }

  async getBusinessSettings(): Promise<BusinessSettingsData> {
    return this.settings ?? DEFAULT_BUSINESS_SETTINGS;
  }

  async getOperatingHours(): Promise<OperatingHoursRow[]> {
    return defaultOperatingHours().map((fallback) => this.hours.get(fallback.weekday) ?? fallback);
  }

  async saveSettings(input: SaveSettingsInput): Promise<void> {
    const current = this.settings ?? DEFAULT_BUSINESS_SETTINGS;
    this.settings = {
      businessName: input.businessName,
      tagline: input.tagline,
      ownerName: input.ownerName,
      email: input.email,
      phone: input.phone,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      zip: input.zip,
      timeZone: input.timeZone,
      currency: input.currency,
      logoKey: input.logoKey === undefined ? current.logoKey : input.logoKey,
      allowLocalDropOff: input.allowLocalDropOff,
      allowMailIn: input.allowMailIn,
    };
    for (const row of input.hours) this.hours.set(row.weekday, row);
  }

  async setLogoKey(logoKey: string | null): Promise<void> {
    this.settings = { ...(this.settings ?? DEFAULT_BUSINESS_SETTINGS), logoKey };
  }
}
