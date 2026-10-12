import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { SettingsRepository } from "../repositories/settings-repository";

/**
 * Business Logo's upload finish: stores the key the direct upload (POST
 * /api/v1/admin/settings/logo-upload) wrote to, without touching anything
 * else saveSettings writes. Setting the same key twice changes nothing
 * further (ADR-0012).
 */
export async function setLogo(deps: { settings: SettingsRepository }, actingUser: ActingUser, logoKey: string): Promise<void> {
  requireRole(actingUser, "ADMIN");
  const business = await deps.settings.getBusinessSettings();
  const hours = await deps.settings.getOperatingHours();
  await deps.settings.saveSettings({ ...business, hours, logoKey });
}
