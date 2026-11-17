// An Inventory Item's "Add Image": mints one storage key and presigned
// upload target (ADR-0004). The browser uploads straight to storage, then
// calls addInventoryImage with the returned key.

import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { FileStorage, UploadTarget } from "@/shared/storage";
import { INVENTORY_ID_PATTERN, isPhotoContentType, MAX_PHOTO_BYTES, newInventoryImageKey } from "../inventory-image-keys";
import { InventoryValidationError } from "./inventory-validation";

export interface InventoryImageUpload extends UploadTarget {
  key: string;
}

export async function requestInventoryImageUpload(
  deps: { storage: FileStorage },
  actingUser: ActingUser,
  input: { itemId: string; contentType: string; size: number },
): Promise<InventoryImageUpload> {
  requireRole(actingUser, "ADMIN");
  if (!INVENTORY_ID_PATTERN.test(input.itemId)) throw new InventoryValidationError("That item isn't valid. Reload and try again.");
  if (!isPhotoContentType(input.contentType)) throw new InventoryValidationError("Images must be JPEG, PNG, WebP or HEIC.");
  if (!Number.isSafeInteger(input.size) || input.size <= 0 || input.size > MAX_PHOTO_BYTES) throw new InventoryValidationError(`Images must be under ${MAX_PHOTO_BYTES / 1024 / 1024} MB.`);

  const key = newInventoryImageKey(input.itemId, input.contentType);
  const target = await deps.storage.createUploadTarget({ key, contentType: input.contentType, maxBytes: input.size });
  return { key, ...target };
}
