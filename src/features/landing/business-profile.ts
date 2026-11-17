// The business profile Settings holds, as the public pages show it
// (site footer, Contact page). Every field is optional: an empty one falls
// back to what the page rendered before Settings fed it.

import type { SiteSettings } from "@/features/settings/use-cases/get-site-settings";

export interface BusinessProfile {
  /** Settings' business name; blank falls back to the caller's default. */
  name: string | null;
  /** "Brooklyn, NY": only when both city and state are set. */
  location: string | null;
  email: string | null;
  phone: string | null;
}

const clean = (value: string | null) => value?.trim() || null;

export function businessProfile(settings: Pick<SiteSettings, "businessName" | "city" | "state" | "email" | "phone"> | null): BusinessProfile {
  const city = clean(settings?.city ?? null);
  const state = clean(settings?.state ?? null);
  return {
    name: clean(settings?.businessName ?? null),
    location: city && state ? `${city}, ${state}` : null,
    email: clean(settings?.email ?? null),
    phone: clean(settings?.phone ?? null),
  };
}

/** A profile that has anything beyond the business name to show. */
export function hasContactDetails(profile: BusinessProfile): boolean {
  return Boolean(profile.location || profile.email || profile.phone);
}

/** `loadSiteSettings`, or null when the database can't be reached: a marketing page shouldn't fail over its footer. */
export async function loadBusinessProfile(
  load: () => Promise<Pick<SiteSettings, "businessName" | "city" | "state" | "email" | "phone">>,
): Promise<BusinessProfile> {
  try {
    return businessProfile(await load());
  } catch {
    return businessProfile(null);
  }
}
