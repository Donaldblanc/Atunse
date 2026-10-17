import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { FileStorage } from "@/shared/storage/file-storage";
import type { BusinessSettingsData, OperatingHoursRow, SettingsRepository } from "../repositories/settings-repository";

/**
 * The Business Profile tab's read: Business Information, Booking Settings
 * and Operating Hours, plus a short-lived view link for the stored logo
 * (the bucket isn't publicly readable — ADR-0004). Admin-only (ADR-0012).
 */
export async function getSettings(
  deps: { settings: SettingsRepository; storage: FileStorage },
  actingUser: ActingUser,
): Promise<{ business: BusinessSettingsData; hours: OperatingHoursRow[]; logoUrl: string | null }> {
  requireRole(actingUser, "ADMIN");
  const [business, hours] = await Promise.all([deps.settings.getBusinessSettings(), deps.settings.getOperatingHours()]);
  const logoUrl = business.logoKey ? await deps.storage.createViewUrl(business.logoKey) : null;
  return { business, hours, logoUrl };
}
