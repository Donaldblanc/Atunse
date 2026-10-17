import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { SettingsRepository } from "../repositories/settings-repository";
import { InvalidLogoUploadError, LOGO_KEY_PATTERN } from "./request-logo-upload";

/**
 * Business Logo's upload finish: stores the key the direct upload (POST
 * /api/v1/admin/settings/logo-upload) wrote to, and nothing else. Only a key
 * in the exact shape requestLogoUpload issues (prefix + UUID, so no "..", no extra path) is accepted, so a posted form
 * can't point the logo at some other stored file. Setting the same key
 * twice changes nothing further (ADR-0012).
 */
export async function setLogo(deps: { settings: SettingsRepository }, actingUser: ActingUser, logoKey: string): Promise<void> {
  requireRole(actingUser, "ADMIN");
  if (!LOGO_KEY_PATTERN.test(logoKey)) throw new InvalidLogoUploadError("That logo upload isn't valid.");
  await deps.settings.setLogoKey(logoKey);
}
