import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { SettingsRepository } from "../repositories/settings-repository";

/**
 * Business Logo's "Remove": clears the stored logoKey without touching
 * anything else saveSettings writes. A repeat changes nothing further
 * (ADR-0012).
 */
export async function removeLogo(deps: { settings: SettingsRepository }, actingUser: ActingUser): Promise<void> {
  requireRole(actingUser, "ADMIN");
  const business = await deps.settings.getBusinessSettings();
  const hours = await deps.settings.getOperatingHours();
  await deps.settings.saveSettings({ ...business, hours, logoKey: null });
}
