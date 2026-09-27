import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { UPLOAD_TARGET_TTL_SECONDS, type FileStorage, type UploadTarget } from "./file-storage";

// Presigned POST rather than PUT: its policy can enforce a size range and
// pin the Content-Type, so a leaked target can't be used to upload
// something else or something huge (ADR-0004 addendum).
export class S3FileStorage implements FileStorage {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    region: string,
    credentials?: { accessKeyId: string; secretAccessKey: string },
  ) {
    this.client = new S3Client({ region, credentials });
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
}
