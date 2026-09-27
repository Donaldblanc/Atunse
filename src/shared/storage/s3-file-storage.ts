import { GetObjectCommand, NoSuchKey, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  INSPECT_HEAD_BYTES,
  UPLOAD_TARGET_TTL_SECONDS,
  VIEW_URL_TTL_SECONDS,
  type FileStorage,
  type StoredObject,
  type UploadTarget,
} from "./file-storage";

export interface S3FileStorageConfig {
  bucket: string;
  region: string;
  /** Set for S3-compatible providers (e.g. Neon storage); unset for AWS. */
  endpoint?: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
}

export function s3ClientFor(config: S3FileStorageConfig): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: config.credentials,
    // S3-compatible endpoints don't serve bucket subdomains
    // (bucket.endpoint), so address the bucket in the path instead.
    forcePathStyle: Boolean(config.endpoint),
  });
}

// Presigned POST rather than PUT: its policy can enforce a size range and
// pin the Content-Type, so a leaked target can't be used to upload
// something else or something huge (ADR-0004 addendum).
export class S3FileStorage implements FileStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3FileStorageConfig) {
    this.bucket = config.bucket;
    this.client = s3ClientFor(config);
  }

  async createUploadTarget(params: { key: string; contentType: string; maxBytes: number }): Promise<UploadTarget> {
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: params.key,
      Conditions: [
        ["content-length-range", 1, params.maxBytes],
        ["eq", "$Content-Type", params.contentType],
      ],
      Fields: { "Content-Type": params.contentType },
      Expires: UPLOAD_TARGET_TTL_SECONDS,
    });
    return { url, fields };
  }

  async inspect(key: string): Promise<StoredObject | null> {
    try {
      // One ranged GET gives the first bytes, the stored type, and (from
      // Content-Range) the full size.
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=0-${INSPECT_HEAD_BYTES - 1}` }),
      );
      const head = res.Body ? await res.Body.transformToByteArray() : new Uint8Array();
      const total = res.ContentRange?.match(/\/(\d+)$/)?.[1];
      return { size: total ? Number(total) : (res.ContentLength ?? head.length), contentType: res.ContentType ?? null, head };
    } catch (err) {
      if (err instanceof NoSuchKey || (err as { name?: string }).name === "NoSuchKey") return null;
      throw err;
    }
  }

  async createViewUrl(key: string): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: VIEW_URL_TTL_SECONDS,
    });
  }
}
