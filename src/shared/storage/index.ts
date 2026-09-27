import path from "node:path";
import { StorageNotConfiguredError, type FileStorage } from "./file-storage";
import { LocalFileStorage } from "./local-file-storage";
import { S3FileStorage, type S3FileStorageConfig } from "./s3-file-storage";

export {
  StorageNotConfiguredError,
  type FileStorage,
  type UploadTarget,
} from "./file-storage";

const LOCAL_UPLOAD_DIR = ".uploads";

/**
 * Picks the storage driver from env (ADR-0004). `STORAGE_DRIVER=s3|local`;
 * defaults to `local` outside production and `s3` in production. The local
 * driver is refused in production (Vercel's filesystem is read-only and
 * per-instance), so a deploy without S3 config fails loudly here instead
 * of losing photos.
 */
export function getFileStorage(
  env: NodeJS.ProcessEnv = process.env,
): FileStorage {
  const isProduction = env.NODE_ENV === "production";
  // Blank counts as unset: .env.example ships `STORAGE_DRIVER=`.
  const driver = env.STORAGE_DRIVER?.trim() || (isProduction ? "s3" : "local");

  if (driver === "local") {
    if (isProduction)
      throw new StorageNotConfiguredError(
        "The local storage driver can't be used in production.",
      );
    return getLocalFileStorage(env);
  }

  if (driver === "s3") return new S3FileStorage(s3ConfigFromEnv(env));


  throw new StorageNotConfiguredError(`Unknown STORAGE_DRIVER: ${driver}`);
}

/** For the dev-only receiving route. Throws in production. */
export function getLocalFileStorage(
  env: NodeJS.ProcessEnv = process.env,
): LocalFileStorage {
  if (env.NODE_ENV === "production")
    throw new StorageNotConfiguredError(
      "Local uploads are disabled in production.",
    );
  const secret = env.SESSION_SECRET;
  if (!secret)
    throw new StorageNotConfiguredError(
      "SESSION_SECRET must be set to sign local upload targets.",
    );
  return new LocalFileStorage(
    path.join(process.cwd(), LOCAL_UPLOAD_DIR),
    secret,
  );
}

type Credentials = { accessKeyId: string; secretAccessKey: string };

// Credentials are taken as a whole pair so S3_* and AWS_* halves never mix.
// That matters on Vercel, which injects AWS_* values that aren't usable
// credentials: a half-set S3_* pair would otherwise silently pair with them
// and fail later as a signature error. Neither pair set means the SDK's
// default chain (e.g. an IAM role on the host).
function s3Credentials(env: NodeJS.ProcessEnv): Credentials | undefined {
  const accessKeyId = env.S3_ACCESS_KEY_ID;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
  if (!accessKeyId !== !secretAccessKey) {
    throw new StorageNotConfiguredError(
      "Set both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY, or neither.",
    );
  }
  return accessKeyId && secretAccessKey
    ? { accessKeyId, secretAccessKey }
    : undefined;
}

function awsCredentials(env: NodeJS.ProcessEnv): Credentials | undefined {
  const accessKeyId = env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY;
  return accessKeyId && secretAccessKey
    ? { accessKeyId, secretAccessKey }
    : undefined;
}

/**
 * The bucket, region, endpoint and credentials from env. S3_* wins; the
 * AWS_* names are what Neon's storage setup (and the AWS SDK's own
 * conventions) provide, so they work unchanged. Shared by the app and the
 * storage maintenance scripts, so both always talk to the same bucket.
 */
export function s3ConfigFromEnv(env: NodeJS.ProcessEnv = process.env): S3FileStorageConfig {
  const bucket = env.S3_BUCKET;
  const region = env.S3_REGION || env.AWS_REGION;
  if (!bucket || !region) throw new StorageNotConfiguredError("S3_BUCKET and S3_REGION (or AWS_REGION) must be set.");
  const credentials = s3Credentials(env) ?? awsCredentials(env);
  const endpoint = env.S3_ENDPOINT || env.AWS_ENDPOINT_URL_S3 || undefined;
  return { bucket, region, endpoint, credentials };
}
