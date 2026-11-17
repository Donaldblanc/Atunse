import type { OperatingHoursRow, SettingsRepository } from "../repositories/settings-repository";

/**
 * The slice of Settings the customer site and booking read: the hours that
 * decide collection slots, which Fulfillment Methods are on, and the
 * business profile shown in the footer and on the Contact page. Nothing
 * admin-only (owner name, logo, accounts).
 */
export interface SiteSettings {
  hours: OperatingHoursRow[];
  allowLocalDropOff: boolean;
  allowMailIn: boolean;
  businessName: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

/**
 * Public read of Settings for the customer site. Customers are anonymous, so
 * there is no role check: this is why it returns only the fields above and
 * never goes through the admin-only getSettings.
 */
export async function getSiteSettings(deps: { settings: Pick<SettingsRepository, "getBusinessSettings" | "getOperatingHours"> }): Promise<SiteSettings> {
  const [business, hours] = await Promise.all([deps.settings.getBusinessSettings(), deps.settings.getOperatingHours()]);
  return {
    hours,
    allowLocalDropOff: business.allowLocalDropOff,
    allowMailIn: business.allowMailIn,
    businessName: business.businessName,
    email: business.email,
    phone: business.phone,
    addressLine1: business.addressLine1,
    addressLine2: business.addressLine2,
    city: business.city,
    state: business.state,
    zip: business.zip,
  };
}
