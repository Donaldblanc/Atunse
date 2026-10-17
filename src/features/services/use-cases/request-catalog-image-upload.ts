// Edit Service/Bundle's "Add Image": mints one storage key and presigned
// upload target (ADR-0004), the same shape requestPhotoUploads uses for
// booking photos. The browser uploads straight to storage, then calls
// addServiceImage/addBundleImage with the returned key.

import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { FileStorage, UploadTarget } from "@/shared/storage";
import { isPhotoContentType, MAX_PHOTO_BYTES, newBundleImageKey, newServiceImageKey } from "../catalog-image-keys";
import { CatalogValidationError } from "./update-catalog-item";

export interface CatalogImageUpload extends UploadTarget {
  key: string;
}

export interface RequestCatalogImageUploadDeps {
  storage: FileStorage;
}

export async function requestServiceImageUpload(
  deps: RequestCatalogImageUploadDeps,
  actingUser: ActingUser,
  input: { serviceId: string; contentType: string; size: number },
): Promise<CatalogImageUpload> {
  requireRole(actingUser, "ADMIN");
  if (!isPhotoContentType(input.contentType)) throw new CatalogValidationError("Images must be JPEG, PNG, WebP or HEIC.");
  if (input.size <= 0 || input.size > MAX_PHOTO_BYTES) throw new CatalogValidationError(`Images must be under ${MAX_PHOTO_BYTES / 1024 / 1024} MB.`);

  const key = newServiceImageKey(input.serviceId, input.contentType);
  const target = await deps.storage.createUploadTarget({ key, contentType: input.contentType, maxBytes: input.size });
  return { key, ...target };
}

export async function requestBundleImageUpload(
  deps: RequestCatalogImageUploadDeps,
  actingUser: ActingUser,
  input: { bundleId: string; contentType: string; size: number },
): Promise<CatalogImageUpload> {
  requireRole(actingUser, "ADMIN");
  if (!isPhotoContentType(input.contentType)) throw new CatalogValidationError("Images must be JPEG, PNG, WebP or HEIC.");
  if (input.size <= 0 || input.size > MAX_PHOTO_BYTES) throw new CatalogValidationError(`Images must be under ${MAX_PHOTO_BYTES / 1024 / 1024} MB.`);

  const key = newBundleImageKey(input.bundleId, input.contentType);
  const target = await deps.storage.createUploadTarget({ key, contentType: input.contentType, maxBytes: input.size });
  return { key, ...target };
}
