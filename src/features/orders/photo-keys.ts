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

/**
 * Where a submitted booking's photo is kept: a copy of its upload, under a
 * prefix no upload target can write to, so the bytes verified at submit
 * are the bytes stored (#77). Same extension as the upload.
 */
export function storedPhotoKey(batchId: string, index: number, uploadKey: string): string {
  return `photos/${batchId}/${index}.${uploadKey.split(".").pop()}`;
}

export function isBookingPhotoKey(key: string): boolean {
  return PHOTO_KEY_PATTERN.test(key);
}

/** The image type a key's extension promises. */
export function photoKeyContentType(key: string): PhotoContentType | null {
  const extension = key.split(".").pop();
  const match = Object.entries(PHOTO_CONTENT_TYPES).find(([, ext]) => ext === extension);
  return match ? (match[0] as PhotoContentType) : null;
}

const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1", "heif"]);

/**
 * The image type a file's first bytes show, whatever it was labelled as
 * (#77: a target issued for a PNG could otherwise carry any bytes). HEIC
 * and HEIF share one container, so both sniff as "image/heic".
 */
export function sniffPhotoType(head: Uint8Array): PhotoContentType | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to));
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => head[i] === byte)) return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && HEIF_BRANDS.has(ascii(8, 12))) return "image/heic";
  return null;
}

/** Whether a file's bytes match the image type its key promises. */
export function photoMatchesKey(key: string, head: Uint8Array): boolean {
  const promised = photoKeyContentType(key);
  const actual = sniffPhotoType(head);
  if (!promised || !actual) return false;
  const family = (type: PhotoContentType) => (type === "image/heif" ? "image/heic" : type);
  return family(promised) === family(actual);
}
