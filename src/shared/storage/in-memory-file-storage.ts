// Test double for the FileStorage seam: objects live in a Map, targets and
// view links are fake URLs. `put` stands in for the browser's upload.

import type { FileStorage, StoredObject, UploadTarget } from "./file-storage";
import { INSPECT_HEAD_BYTES } from "./file-storage";

/** A minimal valid JPEG header, for photos a test doesn't care about. */
export const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1]);

export class InMemoryFileStorage implements FileStorage {
  readonly objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  readonly issuedTargets: { key: string; contentType: string; maxBytes: number }[] = [];

  put(key: string, bytes: Uint8Array = JPEG_BYTES, contentType = "image/jpeg"): void {
    this.objects.set(key, { bytes, contentType });
  }

  async createUploadTarget(params: { key: string; contentType: string; maxBytes: number }): Promise<UploadTarget> {
    this.issuedTargets.push(params);
    return { url: "https://storage.test/upload", fields: { key: params.key } };
  }

  async createViewUrl(key: string): Promise<string> {
    return `https://storage.test/signed/${key}`;
  }

  async inspect(key: string): Promise<StoredObject | null> {
    const object = this.objects.get(key);
    if (!object) return null;
    return { size: object.bytes.length, contentType: object.contentType, head: object.bytes.slice(0, INSPECT_HEAD_BYTES) };
  }
}
