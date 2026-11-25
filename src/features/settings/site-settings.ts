import { cache } from "react";
import { buildSettingsDeps } from "./deps";
import { getSiteSettings, type SiteSettings } from "./use-cases/get-site-settings";

/**
 * Server-side only (it reads the database). The customer site's view of
 * Settings, read once per request. Pages that render it stay cached until an
 * admin save calls revalidatePath (settings-actions.ts).
 */
export const loadSiteSettings = cache(async (): Promise<SiteSettings> => getSiteSettings(buildSettingsDeps()));
