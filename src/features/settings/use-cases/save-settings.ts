import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { OperatingHoursRow, SaveSettingsInput, SettingsRepository } from "../repositories/settings-repository";

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

/**
 * Trims and checks the Business Profile form, or says what's wrong with
 * each field. A closed weekday's times aren't checked (the form disables
 * them, and a stale closed row's times don't matter).
 */
export function cleanSettings(raw: RawSettings): { ok: true; input: Omit<SaveSettingsInput, "logoKey"> } | { ok: false; errors: SettingsErrors } {
  const errors: SettingsErrors = {};
  const businessName = raw.businessName.trim();
  const email = raw.email.trim();
  const timeZone = raw.timeZone.trim();
  const currency = raw.currency.trim().toUpperCase();

  if (!businessName) errors.businessName = "Enter the business name.";
  else if (businessName.length > 120) errors.businessName = "Keep this under 120 characters.";
  if (email && !email.includes("@")) errors.email = "Enter a valid email address.";
  if (!timeZone) errors.timeZone = "Choose a time zone.";
  if (!/^[A-Z]{3}$/.test(currency)) errors.currency = "Use a 3-letter currency code, like USD.";

  const hours: OperatingHoursRow[] = raw.hours.map((row) => {
    if (!row.isOpen) return { weekday: row.weekday, isOpen: false, opensAt: 0, closesAt: 0 };
    const opensAt = parseClock(row.opensAt);
    const closesAt = parseClock(row.closesAt);
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

  const cleaned = cleanSettings(raw);
  if (!cleaned.ok) return { ok: false, errors: cleaned.errors };

  await deps.settings.saveSettings({ ...cleaned.input, logoKey });
  return { ok: true };
}
