// Storage keys for Service/Bundle images (ADR-0004), the same content-type
// rules booking photos use (`orders/photo-keys.ts`), under their own
// prefix so a Service image key can't be replayed as a booking photo key.

import { randomUUID } from "node:crypto";
import { isPhotoContentType, MAX_PHOTO_BYTES, PHOTO_CONTENT_TYPES, type PhotoContentType } from "@/features/orders/photo-keys";

export { isPhotoContentType, MAX_PHOTO_BYTES, type PhotoContentType };

export function newServiceImageKey(serviceId: string, contentType: PhotoContentType): string {
  return `services/${serviceId}/${randomUUID()}.${PHOTO_CONTENT_TYPES[contentType]}`;
}

export function newBundleImageKey(bundleId: string, contentType: PhotoContentType): string {
  return `bundles/${bundleId}/${randomUUID()}.${PHOTO_CONTENT_TYPES[contentType]}`;
}
