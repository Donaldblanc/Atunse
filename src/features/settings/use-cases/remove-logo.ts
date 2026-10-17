import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { SettingsRepository } from "../repositories/settings-repository";

/**
 * Business Logo's "Remove": clears the stored logoKey and nothing else. A
 * repeat changes nothing further (ADR-0012).
 */
export async function removeLogo(deps: { settings: SettingsRepository }, actingUser: ActingUser): Promise<void> {
  requireRole(actingUser, "ADMIN");
  await deps.settings.setLogoKey(null);
}
