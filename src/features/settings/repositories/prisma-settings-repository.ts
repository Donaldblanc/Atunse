import type { PrismaClient } from "@prisma/client";
import {
  DEFAULT_BUSINESS_SETTINGS,
  defaultOperatingHours,
  type BusinessSettingsData,
  type OperatingHoursRow,
  type SaveSettingsInput,
  type SettingsRepository,
} from "./settings-repository";

const SETTINGS_ID = 1;

export class PrismaSettingsRepository implements SettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getBusinessSettings(): Promise<BusinessSettingsData> {
    const row = await this.prisma.businessSettings.findUnique({ where: { id: SETTINGS_ID } });
    if (!row) return DEFAULT_BUSINESS_SETTINGS;
    // websiteUrl is a column the Settings screen doesn't own yet (not in BusinessSettingsData).
    const { id, updatedAt, websiteUrl, ...rest } = row;
    return rest;
  }

  async getOperatingHours(): Promise<OperatingHoursRow[]> {
    const rows = await this.prisma.operatingHours.findMany();
    const byWeekday = new Map(rows.map((row) => [row.weekday, row]));
    return defaultOperatingHours().map((fallback) => byWeekday.get(fallback.weekday) ?? fallback);
  }

  async saveSettings(input: SaveSettingsInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.businessSettings.findUnique({ where: { id: SETTINGS_ID }, select: { logoKey: true } });
      const logoKey = input.logoKey === undefined ? current?.logoKey ?? null : input.logoKey;
      const fields = {
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
        logoKey,
        allowLocalDropOff: input.allowLocalDropOff,
        allowMailIn: input.allowMailIn,
      };
      await tx.businessSettings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID, ...fields }, update: fields });

      for (const row of input.hours) {
        await tx.operatingHours.upsert({
          where: { weekday: row.weekday },
          create: row,
          update: { isOpen: row.isOpen, opensAt: row.opensAt, closesAt: row.closesAt },
        });
      }
    });
  }

  async setLogoKey(logoKey: string | null): Promise<void> {
    await this.prisma.businessSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...DEFAULT_BUSINESS_SETTINGS, logoKey },
      update: { logoKey },
    });
  }
}
