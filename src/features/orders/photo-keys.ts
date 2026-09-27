// Storage keys for booking photos (ADR-0004). The server mints every key in
// POST /api/v1/uploads; submitOrder only accepts keys of this shape, so a
// client can't attach arbitrary objects in the bucket to an Order.

export const PHOTO_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
} as const;

export type PhotoContentType = keyof typeof PHOTO_CONTENT_TYPES;

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const MAX_PHOTOS_PER_ITEM = 10;

const PHOTO_KEY_PATTERN = /^bookings\/[0-9a-f-]{36}\/\d{1,2}\.(jpg|png|webp|heic|heif)$/;

export function isPhotoContentType(value: string): value is PhotoContentType {
  return Object.hasOwn(PHOTO_CONTENT_TYPES, value);
}

export function newPhotoKey(batchId: string, index: number, contentType: PhotoContentType): string {
  return `bookings/${batchId}/${index}.${PHOTO_CONTENT_TYPES[contentType]}`;
}

export function isBookingPhotoKey(key: string): boolean {
  return PHOTO_KEY_PATTERN.test(key);
}
