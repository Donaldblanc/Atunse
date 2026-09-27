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
}

export class StorageNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageNotConfiguredError";
  }
}

/** How long an issued upload target stays valid. */
export const UPLOAD_TARGET_TTL_SECONDS = 10 * 60;
