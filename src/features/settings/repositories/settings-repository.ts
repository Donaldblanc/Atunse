// The SettingsRepository seam (ADR-0003/0011): the singleton
// BusinessSettings row and the 7 OperatingHours rows (one per weekday).
// Only the Prisma implementation imports Prisma.

/** Weekday numbering matches JS `Date#getDay()`: 0 = Sunday .. 6 = Saturday. */
export interface OperatingHoursRow {
  weekday: number;
  isOpen: boolean;
  /** Minutes since midnight, e.g. 480 = 8:00 AM. */
  opensAt: number;
  /** Minutes since midnight, e.g. 1320 = 10:00 PM. */
  closesAt: number;
}

export interface BusinessSettingsData {
  businessName: string;
  tagline: string | null;
  ownerName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  timeZone: string;
  currency: string;
  logoKey: string | null;
  allowLocalDropOff: boolean;
  allowMailIn: boolean;
}

/** What the Business Profile tab's Save Changes writes, in one transaction. */
export interface SaveSettingsInput {
  businessName: string;
  tagline: string | null;
  ownerName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  timeZone: string;
  currency: string;
  /** `undefined` leaves the stored logo untouched; `null` removes it. */
  logoKey?: string | null;
  allowLocalDropOff: boolean;
  allowMailIn: boolean;
  /** All 7 weekdays, replacing whatever was stored for each. */
  hours: OperatingHoursRow[];
}

export interface SettingsRepository {
  /** The singleton row's current values, or sensible defaults before it's ever been saved. */
  getBusinessSettings(): Promise<BusinessSettingsData>;
  /** All 7 weekdays, defaulting any missing one to closed. */
  getOperatingHours(): Promise<OperatingHoursRow[]>;
  /**
   * Business Information, Booking Settings and Operating Hours in one
   * transaction. A replay with the same values changes nothing extra: this
   * is a plain field overwrite, so applying it twice is harmless (ADR-0012).
   */
  saveSettings(input: SaveSettingsInput): Promise<void>;
}

/** Shown before BusinessSettings has ever been saved. */
export const DEFAULT_BUSINESS_SETTINGS: BusinessSettingsData = {
  businessName: "Atunṣe",
  tagline: null,
  ownerName: null,
  email: null,
  phone: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  zip: null,
  timeZone: "America/New_York",
  currency: "USD",
  logoKey: null,
  allowLocalDropOff: true,
  allowMailIn: true,
};

/** Shown for any weekday OperatingHours has never stored a row for. */
export function defaultOperatingHours(): OperatingHoursRow[] {
  return Array.from({ length: 7 }, (_, weekday) => ({ weekday, isOpen: false, opensAt: 480, closesAt: 1320 }));
}
