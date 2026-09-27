// The storage seam (ADR-0004). Use-cases and routes depend on this
// interface only; S3 (s3-file-storage.ts) is the real implementation and
// local-file-storage.ts stands in during development. The browser uploads
// straight to the returned target, so the app server never proxies file
// bytes in production.

/** A form POST target: send `fields` plus the file (last, as "file"). */
export interface UploadTarget {
  url: string;
  fields: Record<string, string>;
}

export interface FileStorage {
  createUploadTarget(params: { key: string; contentType: string; maxBytes: number }): Promise<UploadTarget>;
  /**
   * A short-lived link that shows one private object. The bucket itself is
   * never publicly readable; callers must authorize the viewer first.
   */
  createViewUrl(key: string): Promise<string>;
  /**
   * What's actually stored under `key`: its size, stored Content-Type and
   * first bytes (for checking the file really is what it claims), or null
   * if nothing was uploaded there. One request per object.
   */
  inspect(key: string): Promise<StoredObject | null>;
  /**
   * Copies an object to a new key, keeping its Content-Type. Returns false
   * (copying nothing) when there's no object at `fromKey`. Used to move a
   * booking's photos out of reach of their upload targets (#77).
   */
  copy(fromKey: string, toKey: string): Promise<boolean>;
}

export interface StoredObject {
  size: number;
  /** The Content-Type the object was stored with (the upload target pins it). */
  contentType: string | null;
  /** The first INSPECT_HEAD_BYTES bytes (fewer if the file is shorter). */
  head: Uint8Array;
}

/** Enough bytes to recognize every allowed image format's signature. */
export const INSPECT_HEAD_BYTES = 16;

export class StorageNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageNotConfiguredError";
  }
}

/**
 * How long an issued upload target stays valid. Storage checks it when an
 * upload starts, and a booking's photos upload in parallel right away, so
 * a few minutes is plenty; a leaked target is useless soon after (#77).
 */
export const UPLOAD_TARGET_TTL_SECONDS = 5 * 60;

/** How long a photo view link works. */
export const VIEW_URL_TTL_SECONDS = 5 * 60;
