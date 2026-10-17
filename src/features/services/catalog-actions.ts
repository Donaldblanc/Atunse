"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { UnauthorizedError } from "@/features/accounts/authz";
import { parseDollarsToCents } from "./dollars";
import { buildCatalogDeps } from "./deps";
import {
  BundleIdTakenError,
  CatalogChangedError,
  CatalogImageKeyTakenError,
  BundleNotFoundError,
  CatalogImageNotFoundError,
  ServiceNotFoundError,
  TooManyCatalogImagesError,
  type ServiceCategory,
} from "./repositories/catalog-repository";
import { addBundleImage, addServiceImage, removeBundleImage, removeServiceImage } from "./use-cases/catalog-image";
import { createBundle } from "./use-cases/create-bundle";
import { requestBundleImageUpload, requestServiceImageUpload } from "./use-cases/request-catalog-image-upload";
import { setBundleActive, setServiceActive } from "./use-cases/set-catalog-item-active";
import { CatalogValidationError, SERVICE_CATEGORIES, updateBundle, updateService } from "./use-cases/update-catalog-item";

export type CatalogFormState = { error: string | null };

const CHANGED_ELSEWHERE = "This was changed elsewhere. Reload and try again.";

/** The `updatedAt` the edit form was rendered with (ISO string in a hidden field); null if missing or malformed. */
function expectedUpdatedAt(formData: FormData): Date | null {
  const date = new Date(text(formData, "updatedAt"));
  return Number.isNaN(date.getTime()) ? null : date;
}

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

function dollarsToCents(formData: FormData, name: string): number {
  return parseDollarsToCents(text(formData, name));
}

function returnToAdmin(formData: FormData, fallback: string): string {
  const returnTo = text(formData, "returnTo");
  return returnTo.startsWith("/admin") ? returnTo : fallback;
}

/** Edit Service's Save Changes. */
export async function updateServiceAction(_previous: CatalogFormState, formData: FormData): Promise<CatalogFormState> {
  const serviceId = text(formData, "serviceId");
  if (!serviceId) return { error: "That request wasn't valid. Reload and try again." };

  const expected = expectedUpdatedAt(formData);
  if (!expected) return { error: CHANGED_ELSEWHERE };

  const category = text(formData, "category") as ServiceCategory;
  if (!SERVICE_CATEGORIES.includes(category)) return { error: "Pick a valid category." };

  try {
    const actingUser = await actingUserFromCookies(await cookies());
    await updateService(buildCatalogDeps(), actingUser, {
      serviceId,
      name: text(formData, "name"),
      description: text(formData, "description"),
      baseCents: dollarsToCents(formData, "baseDollars"),
      suedeFeeCents: dollarsToCents(formData, "suedeDollars"),
      category,
      active: formData.get("active") === "on",
      internalNotes: text(formData, "internalNotes") || null,
      expectedUpdatedAt: expected,
    });
  } catch (err) {
    if (err instanceof CatalogValidationError) return { error: err.message };
    if (err instanceof CatalogChangedError) return { error: err.message };
    if (err instanceof ServiceNotFoundError) return { error: "This service no longer exists." };
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that." };
    throw err;
  }

  revalidatePath("/admin/services");
  redirect(returnToAdmin(formData, "/admin/services"));
}

/** "Delete Service" (reads as destructive, really deactivates — Services are never deleted since past Items name them) or the Active toggle turning a service back on. */
export async function setServiceActiveAction(_previous: CatalogFormState, formData: FormData): Promise<CatalogFormState> {
  const serviceId = text(formData, "serviceId");
  const active = text(formData, "active") === "true";
  if (!serviceId) return { error: "That request wasn't valid. Reload and try again." };

  try {
    const actingUser = await actingUserFromCookies(await cookies());
    await setServiceActive(buildCatalogDeps(), actingUser, serviceId, active);
  } catch (err) {
    if (err instanceof ServiceNotFoundError) return { error: "This service no longer exists." };
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that." };
    throw err;
  }

  revalidatePath("/admin/services");
  redirect(returnToAdmin(formData, "/admin/services"));
}

/** Edit Bundle's Save Changes. */
export async function updateBundleAction(_previous: CatalogFormState, formData: FormData): Promise<CatalogFormState> {
  const bundleId = text(formData, "bundleId");
  if (!bundleId) return { error: "That request wasn't valid. Reload and try again." };

  const expected = expectedUpdatedAt(formData);
  if (!expected) return { error: CHANGED_ELSEWHERE };

  const perks = text(formData, "perks").split("\n");

  try {
    const actingUser = await actingUserFromCookies(await cookies());
    await updateBundle(buildCatalogDeps(), actingUser, {
      bundleId,
      name: text(formData, "name"),
      priceCents: dollarsToCents(formData, "priceDollars"),
      perks,
      active: formData.get("active") === "on",
      internalNotes: text(formData, "internalNotes") || null,
      expectedUpdatedAt: expected,
    });
  } catch (err) {
    if (err instanceof CatalogValidationError) return { error: err.message };
    if (err instanceof CatalogChangedError) return { error: err.message };
    if (err instanceof BundleNotFoundError) return { error: "This bundle no longer exists." };
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that." };
    throw err;
  }

  revalidatePath("/admin/services");
  redirect(returnToAdmin(formData, "/admin/services"));
}

/** "Delete Bundle" (deactivate, same no-hard-delete rule as Service) or reactivating. */
export async function setBundleActiveAction(_previous: CatalogFormState, formData: FormData): Promise<CatalogFormState> {
  const bundleId = text(formData, "bundleId");
  const active = text(formData, "active") === "true";
  if (!bundleId) return { error: "That request wasn't valid. Reload and try again." };

  try {
    const actingUser = await actingUserFromCookies(await cookies());
    await setBundleActive(buildCatalogDeps(), actingUser, bundleId, active);
  } catch (err) {
    if (err instanceof BundleNotFoundError) return { error: "This bundle no longer exists." };
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that." };
    throw err;
  }

  revalidatePath("/admin/services");
  redirect(returnToAdmin(formData, "/admin/services"));
}

/** Bundles tab's Add Bundle. */
export async function createBundleAction(_previous: CatalogFormState, formData: FormData): Promise<CatalogFormState> {
  try {
    const actingUser = await actingUserFromCookies(await cookies());
    await createBundle(buildCatalogDeps(), actingUser, {
      name: text(formData, "name"),
      priceCents: dollarsToCents(formData, "priceDollars"),
      perks: text(formData, "perks").split("\n"),
    });
  } catch (err) {
    if (err instanceof CatalogValidationError) return { error: err.message };
    if (err instanceof BundleIdTakenError) return { error: "A bundle with that name already exists." };
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that." };
    throw err;
  }

  revalidatePath("/admin/services");
  redirect(returnToAdmin(formData, "/admin/services"));
}

export type ImageUploadTarget = { url: string; fields: Record<string, string>; key: string };
export type RequestImageUploadResult = { upload: ImageUploadTarget } | { error: string };

/** Picked from Edit Service's Add Image: a presigned upload target (ADR-0004). Called directly from the image uploader's client code, not a form. */
export async function requestServiceImageUploadAction(serviceId: string, contentType: string, size: number): Promise<RequestImageUploadResult> {
  try {
    const actingUser = await actingUserFromCookies(await cookies());
    const upload = await requestServiceImageUpload(buildCatalogDeps(), actingUser, { serviceId, contentType, size });
    return { upload };
  } catch (err) {
    if (err instanceof CatalogValidationError) return { error: err.message };
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that." };
    throw err;
  }
}

export async function requestBundleImageUploadAction(bundleId: string, contentType: string, size: number): Promise<RequestImageUploadResult> {
  try {
    const actingUser = await actingUserFromCookies(await cookies());
    const upload = await requestBundleImageUpload(buildCatalogDeps(), actingUser, { bundleId, contentType, size });
    return { upload };
  } catch (err) {
    if (err instanceof CatalogValidationError) return { error: err.message };
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that." };
    throw err;
  }
}

export type CatalogImageActionResult = { ok: true } | { error: string };

/** Records an uploaded key against the Service, once the browser's presigned upload finished. */
export async function addServiceImageAction(serviceId: string, key: string): Promise<CatalogImageActionResult> {
  try {
    const actingUser = await actingUserFromCookies(await cookies());
    await addServiceImage(buildCatalogDeps(), actingUser, serviceId, key);
  } catch (err) {
    if (err instanceof TooManyCatalogImagesError || err instanceof CatalogImageKeyTakenError || err instanceof CatalogValidationError) return { error: err.message };
    if (err instanceof ServiceNotFoundError) return { error: "This service no longer exists." };
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that." };
    throw err;
  }
  revalidatePath("/admin/services");
  return { ok: true };
}

export async function removeServiceImageAction(serviceId: string, imageId: string): Promise<CatalogImageActionResult> {
  try {
    const actingUser = await actingUserFromCookies(await cookies());
    await removeServiceImage(buildCatalogDeps(), actingUser, serviceId, imageId);
  } catch (err) {
    if (err instanceof CatalogImageNotFoundError) return { ok: true }; // already removed
    if (err instanceof ServiceNotFoundError) return { error: "This service no longer exists." };
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that." };
    throw err;
  }
  revalidatePath("/admin/services");
  return { ok: true };
}

export async function addBundleImageAction(bundleId: string, key: string): Promise<CatalogImageActionResult> {
  try {
    const actingUser = await actingUserFromCookies(await cookies());
    await addBundleImage(buildCatalogDeps(), actingUser, bundleId, key);
  } catch (err) {
    if (err instanceof TooManyCatalogImagesError || err instanceof CatalogImageKeyTakenError || err instanceof CatalogValidationError) return { error: err.message };
    if (err instanceof BundleNotFoundError) return { error: "This bundle no longer exists." };
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that." };
    throw err;
  }
  revalidatePath("/admin/services");
  return { ok: true };
}

export async function removeBundleImageAction(bundleId: string, imageId: string): Promise<CatalogImageActionResult> {
  try {
    const actingUser = await actingUserFromCookies(await cookies());
    await removeBundleImage(buildCatalogDeps(), actingUser, bundleId, imageId);
  } catch (err) {
    if (err instanceof CatalogImageNotFoundError) return { ok: true };
    if (err instanceof BundleNotFoundError) return { error: "This bundle no longer exists." };
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that." };
    throw err;
  }
  revalidatePath("/admin/services");
  return { ok: true };
}
