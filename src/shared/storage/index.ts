import path from "node:path";
import { StorageNotConfiguredError, type FileStorage } from "./file-storage";
import { LocalFileStorage } from "./local-file-storage";
import { S3FileStorage } from "./s3-file-storage";

export { StorageNotConfiguredError, type FileStorage, type UploadTarget } from "./file-storage";

const LOCAL_UPLOAD_DIR = ".uploads";

/**
 * Picks the storage driver from env (ADR-0004). `STORAGE_DRIVER=s3|local`;
 * defaults to `local` outside production and `s3` in production. The local
 * driver is refused in production (Vercel's filesystem is read-only and
 * per-instance), so a deploy without S3 config fails loudly here instead
 * of losing photos.
 */
export function getFileStorage(env: NodeJS.ProcessEnv = process.env): FileStorage {
  const isProduction = env.NODE_ENV === "production";
  const driver = env.STORAGE_DRIVER ?? (isProduction ? "s3" : "local");

  if (driver === "local") {
    if (isProduction) throw new StorageNotConfiguredError("The local storage driver can't be used in production.");
    return getLocalFileStorage(env);
  }

  if (driver === "s3") {
    // S3_* wins; the AWS_* names are what Neon's storage setup (and the
    // AWS SDK's own conventions) provide, so they work unchanged.
    const bucket = env.S3_BUCKET;
    const region = env.S3_REGION || env.AWS_REGION;
    if (!bucket || !region) throw new StorageNotConfiguredError("S3_BUCKET and S3_REGION (or AWS_REGION) must be set.");
    const accessKeyId = env.S3_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY;
    const credentials =
      accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey }
        : undefined; // e.g. an IAM role on the host: the SDK's default chain finds it
    const endpoint = env.S3_ENDPOINT || env.AWS_ENDPOINT_URL_S3 || undefined;
    return new S3FileStorage({ bucket, region, endpoint, credentials });
  }

  throw new StorageNotConfiguredError(`Unknown STORAGE_DRIVER: ${driver}`);
}

/** For the dev-only receiving route. Throws in production. */
export function getLocalFileStorage(env: NodeJS.ProcessEnv = process.env): LocalFileStorage {
  if (env.NODE_ENV === "production") throw new StorageNotConfiguredError("Local uploads are disabled in production.");
  const secret = env.SESSION_SECRET;
  if (!secret) throw new StorageNotConfiguredError("SESSION_SECRET must be set to sign local upload targets.");
  return new LocalFileStorage(path.join(process.cwd(), LOCAL_UPLOAD_DIR), secret);
}
