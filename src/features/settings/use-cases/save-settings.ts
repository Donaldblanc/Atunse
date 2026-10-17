import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { isValidEmail } from "@/features/orders/contact-rules";
import { defaultOperatingHours, type OperatingHoursRow, SaveSettingsInput, SettingsRepository } from "../repositories/settings-repository";

/** What the Business Profile form posts for one weekday row. */
export interface RawHoursRow {
  weekday: number;
  isOpen: boolean;
  /** "HH:MM" 24-hour, e.g. "08:00". */
  opensAt: string;
  closesAt: string;
}

/** What the Business Profile form's Save Changes posts, raw text, validated here. */
export interface RawSettings {
  businessName: string;
  tagline: string;
  ownerName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  timeZone: string;
  currency: string;
  allowLocalDropOff: boolean;
  allowMailIn: boolean;
  hours: RawHoursRow[];
}

export type SettingsErrors = Record<string, string>;

const blankToNull = (value: string): string | null => (value.trim() ? value.trim() : null);

function parseClock(value: string): number | null {
  const match = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

const PHONE_PATTERN = /^[\d\s()+-]+$/;

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Trims and checks the Business Profile form, or says what's wrong with
 * each field. A closed weekday's times aren't required, but the database
 * still needs opensAt < closesAt, so a closed day keeps the posted times if
 * they're valid, else the `stored` ones, else the 8:00-22:00 default.
 */
export function cleanSettings(
  raw: RawSettings,
  stored: OperatingHoursRow[] = defaultOperatingHours(),
): { ok: true; input: Omit<SaveSettingsInput, "logoKey"> } | { ok: false; errors: SettingsErrors } {
  const errors: SettingsErrors = {};
  const businessName = raw.businessName.trim();
  const email = raw.email.trim();
  const timeZone = raw.timeZone.trim();
  const currency = raw.currency.trim().toUpperCase();

  if (!businessName) errors.businessName = "Enter the business name.";
  else if (businessName.length > 120) errors.businessName = "Keep this under 120 characters.";
  if (email && (!isValidEmail(email) || email.length > 254)) errors.email = "Enter a valid email address.";
  const phone = raw.phone.trim();
  if (phone) {
    const digitCount = phone.replace(/\D/g, "").length;
    if (!PHONE_PATTERN.test(phone) || digitCount < 7 || digitCount > 15) errors.phone = "Enter a valid phone number.";
  }
  if (!timeZone) errors.timeZone = "Choose a time zone.";
  else if (!isValidTimeZone(timeZone)) errors.timeZone = "Use a valid time zone, like America/New_York.";
  if (!/^[A-Z]{3}$/.test(currency)) errors.currency = "Use a 3-letter currency code, like USD.";

  const hours: OperatingHoursRow[] = raw.hours.map((row) => {
    const opensAt = parseClock(row.opensAt);
    const closesAt = parseClock(row.closesAt);
    if (!row.isOpen) {
      if (opensAt !== null && closesAt !== null && opensAt < closesAt) return { weekday: row.weekday, isOpen: false, opensAt, closesAt };
      const fallback = stored.find((s) => s.weekday === row.weekday) ?? defaultOperatingHours()[row.weekday];
      return { weekday: row.weekday, isOpen: false, opensAt: fallback?.opensAt ?? 480, closesAt: fallback?.closesAt ?? 1320 };
    }
    if (opensAt === null || closesAt === null || opensAt >= closesAt) {
      errors[`hours:${row.weekday}`] = "Enter a valid open-before-close time.";
      return { weekday: row.weekday, isOpen: true, opensAt: opensAt ?? 0, closesAt: closesAt ?? 0 };
    }
    return { weekday: row.weekday, isOpen: true, opensAt, closesAt };
  });

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    input: {
      businessName,
      tagline: blankToNull(raw.tagline),
      ownerName: blankToNull(raw.ownerName),
      email: blankToNull(email),
      phone: blankToNull(raw.phone),
      addressLine1: blankToNull(raw.addressLine1),
      addressLine2: blankToNull(raw.addressLine2),
      city: blankToNull(raw.city),
      state: blankToNull(raw.state),
      zip: blankToNull(raw.zip),
      timeZone,
      currency,
      allowLocalDropOff: raw.allowLocalDropOff,
      allowMailIn: raw.allowMailIn,
      hours,
    },
  };
}

export type SaveResult = { ok: true } | { ok: false; errors: SettingsErrors };

/**
 * Business Profile's Save Changes: Business Information, Booking Settings
 * and Operating Hours in one transaction (saveSettings). `logoKey` is
 * omitted here (left untouched) unless the caller explicitly passes it, so
 * this one save can't accidentally clear a logo set by a separate upload.
 * Replaying the same input is harmless: it's a plain field overwrite
 * (ADR-0012).
 */
export async function saveSettings(
  deps: { settings: SettingsRepository },
  actingUser: ActingUser,
  raw: RawSettings,
  logoKey?: string | null,
): Promise<SaveResult> {
  requireRole(actingUser, "ADMIN");

  const cleaned = cleanSettings(raw, await deps.settings.getOperatingHours());
  if (!cleaned.ok) return { ok: false, errors: cleaned.errors };

  await deps.settings.saveSettings({ ...cleaned.input, logoKey });
  return { ok: true };
}
