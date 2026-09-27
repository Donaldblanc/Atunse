import { randomUUID } from "node:crypto";
import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { FileStorage, UploadTarget } from "@/shared/storage";
import { isPhotoContentType, MAX_PHOTO_BYTES, MAX_PHOTOS_PER_ITEM, newPhotoKey } from "../photo-keys";
import { BookingValidationError } from "./submit-order";

export interface PhotoUpload extends UploadTarget {
  key: string;
}

/**
 * Before submitOrder: mints one storage key and presigned upload target per
 * photo the customer picked (ADR-0004). The browser uploads straight to
 * storage and then submits the keys with the Order.
 */
export async function requestPhotoUploads(
  deps: { storage: FileStorage; newBatchId?: () => string },
  actingUser: ActingUser,
  files: { contentType: string; size: number }[],
): Promise<PhotoUpload[]> {
  requireRole(actingUser, "GUEST", "CUSTOMER");

  if (files.length === 0) throw new BookingValidationError("Add at least one photo of your pair.");
  if (files.length > MAX_PHOTOS_PER_ITEM) {
    throw new BookingValidationError(`Add at most ${MAX_PHOTOS_PER_ITEM} photos per pair.`);
  }

  const batchId = deps.newBatchId?.() ?? randomUUID();
  return Promise.all(
    files.map(async (file, index) => {
      if (!isPhotoContentType(file.contentType)) {
        throw new BookingValidationError("Photos must be JPEG, PNG, WebP or HEIC images.");
      }
      if (file.size <= 0 || file.size > MAX_PHOTO_BYTES) {
        throw new BookingValidationError(`Each photo must be under ${MAX_PHOTO_BYTES / 1024 / 1024} MB.`);
      }
      const key = newPhotoKey(batchId, index, file.contentType);
      const target = await deps.storage.createUploadTarget({ key, contentType: file.contentType, maxBytes: MAX_PHOTO_BYTES });
      return { key, ...target };
    }),
  );
}
