// Storage keys for Inventory Item images (ADR-0004), the same content-type
// rules booking photos use (`orders/photo-keys.ts`), under their own
// `inventory/` prefix so an item image key can't be replayed as another kind of key.

import { randomUUID } from "node:crypto";
import { isPhotoContentType, MAX_PHOTO_BYTES, PHOTO_CONTENT_TYPES, type PhotoContentType } from "@/features/orders/photo-keys";

export { isPhotoContentType, MAX_PHOTO_BYTES, type PhotoContentType };

/** An item id as it may appear in a storage key: no slashes, dots or anything that could escape the prefix. */
export const INVENTORY_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function newInventoryImageKey(itemId: string, contentType: PhotoContentType): string {
  return `inventory/${itemId}/${randomUUID()}.${PHOTO_CONTENT_TYPES[contentType]}`;
}
