// Filters photos the customer picks against the same limits the server
// enforces (photo-keys.ts), so a bad file is caught when it's added rather
// than as a 400 at the final Confirm. Pure: no React.

import { isPhotoContentType, MAX_PHOTO_BYTES, MAX_PHOTOS_PER_ITEM, PHOTO_CONTENT_TYPES } from "@/features/orders/photo-keys";

/** For the file input's `accept`, so the picker only offers allowed types. */
export const PHOTO_ACCEPT = Object.keys(PHOTO_CONTENT_TYPES).join(",");

export interface SkippedPhoto {
  name: string;
  reason: string;
}

export function selectPhotos(existing: File[], incoming: File[]): { photos: File[]; skipped: SkippedPhoto[] } {
  const photos = [...existing];
  const skipped: SkippedPhoto[] = [];
  for (const file of incoming) {
    if (!isPhotoContentType(file.type)) {
      skipped.push({ name: file.name, reason: "isn't a JPEG, PNG, WebP or HEIC image" });
    } else if (file.size > MAX_PHOTO_BYTES) {
      skipped.push({ name: file.name, reason: `is over ${MAX_PHOTO_BYTES / 1024 / 1024} MB` });
    } else if (photos.length >= MAX_PHOTOS_PER_ITEM) {
      skipped.push({ name: file.name, reason: `is over the ${MAX_PHOTOS_PER_ITEM}-photo limit` });
    } else {
      photos.push(file);
    }
  }
  return { photos, skipped };
}

export function skippedMessage(skipped: SkippedPhoto[]): string | null {
  if (skipped.length === 0) return null;
  return `Skipped ${skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}.`;
}
