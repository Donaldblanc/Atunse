"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { UnauthorizedError } from "@/features/accounts/authz";
import { AdminNotFoundError, changeAdminPassword, updateAdminProfile } from "@/features/accounts/use-cases/update-admin-profile";
import { buildSettingsDeps } from "./deps";
import { removeLogo } from "./use-cases/remove-logo";
import { setLogo } from "./use-cases/set-logo";
import { saveSettings, type RawHoursRow, type SettingsErrors } from "./use-cases/save-settings";

export type SaveSettingsState = { error: string | null; errors: SettingsErrors; saved: number };
export type RemoveLogoState = { error: string | null };
export type ProfileState = { error: string | null };

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * Business Profile's Save Changes: Business Information, Booking Settings
 * and Operating Hours, all in cleanSettings's one transaction. `logoKey`
 * isn't posted by this form (the logo has its own upload/remove actions),
 * so a save here never touches it.
 */
export async function saveSettingsAction(previous: SaveSettingsState, formData: FormData): Promise<SaveSettingsState> {
  if (!text(formData, "idempotencyKey")) return { ...previous, error: "That request wasn't valid. Reload and try again.", errors: {} };

  const hours: RawHoursRow[] = WEEKDAYS.map((weekday) => ({
    weekday,
    isOpen: text(formData, `hours:${weekday}:isOpen`) === "on",
    opensAt: text(formData, `hours:${weekday}:opensAt`),
    closesAt: text(formData, `hours:${weekday}:closesAt`),
  }));

  const raw = {
    businessName: text(formData, "businessName"),
    tagline: text(formData, "tagline"),
    ownerName: text(formData, "ownerName"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    addressLine1: text(formData, "addressLine1"),
    addressLine2: text(formData, "addressLine2"),
    city: text(formData, "city"),
    state: text(formData, "state"),
    zip: text(formData, "zip"),
    timeZone: text(formData, "timeZone"),
    currency: text(formData, "currency"),
    allowLocalDropOff: text(formData, "allowLocalDropOff") === "on",
    allowMailIn: text(formData, "allowMailIn") === "on",
    hours,
  };

  try {
    const actingUser = await actingUserFromCookies(await cookies());
    const result = await saveSettings(buildSettingsDeps(), actingUser, raw);
    if (!result.ok) return { error: null, errors: result.errors, saved: previous.saved };
  } catch (err) {
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that.", errors: {}, saved: previous.saved };
    throw err;
  }

  revalidatePath("/admin/settings");
  return { error: null, errors: {}, saved: previous.saved + 1 };
}

/** Business Logo's upload finish: stores the key the direct upload just wrote to. */
export async function setLogoAction(_previous: RemoveLogoState, formData: FormData): Promise<RemoveLogoState> {
  const logoKey = text(formData, "logoKey");
  if (!logoKey) return { error: "That upload didn't finish. Try again." };

  try {
    const actingUser = await actingUserFromCookies(await cookies());
    await setLogo(buildSettingsDeps(), actingUser, logoKey);
  } catch (err) {
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that." };
    throw err;
  }
  revalidatePath("/admin/settings");
  return { error: null };
}

/** Business Logo's "Remove": clears the stored logo. */
export async function removeLogoAction(_previous: RemoveLogoState): Promise<RemoveLogoState> {
  try {
    const actingUser = await actingUserFromCookies(await cookies());
    await removeLogo(buildSettingsDeps(), actingUser);
  } catch (err) {
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that." };
    throw err;
  }
  revalidatePath("/admin/settings");
  return { error: null };
}

/** Account Settings' "Save": the signed-in admin's own name and email. */
export async function updateAdminProfileAction(_previous: ProfileState, formData: FormData): Promise<ProfileState> {
  const accountId = text(formData, "accountId");
  if (!accountId) return { error: "That request wasn't valid. Reload and try again." };

  try {
    const actingUser = await actingUserFromCookies(await cookies());
    const result = await updateAdminProfile(buildSettingsDeps(), actingUser, {
      accountId,
      name: text(formData, "name"),
      email: text(formData, "email"),
    });
    if (!result.ok) return { error: result.error };
  } catch (err) {
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that." };
    if (err instanceof AdminNotFoundError) return { error: "This admin account no longer exists." };
    throw err;
  }

  revalidatePath("/admin/settings");
  return { error: null };
}

/** Account Settings' "Change Password" — the current password is required (ADR-0005 addendum). */
export async function changeAdminPasswordAction(_previous: ProfileState, formData: FormData): Promise<ProfileState> {
  const accountId = text(formData, "accountId");
  if (!accountId) return { error: "That request wasn't valid. Reload and try again." };

  const newPassword = text(formData, "newPassword");
  if (newPassword !== text(formData, "confirmPassword")) return { error: "Those passwords don't match." };

  try {
    const actingUser = await actingUserFromCookies(await cookies());
    const result = await changeAdminPassword(buildSettingsDeps(), actingUser, {
      accountId,
      currentPassword: text(formData, "currentPassword"),
      newPassword,
    });
    if (!result.ok) return { error: result.error };
  } catch (err) {
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that." };
    if (err instanceof AdminNotFoundError) return { error: "This admin account no longer exists." };
    throw err;
  }

  revalidatePath("/admin/settings");
  return { error: null };
}
