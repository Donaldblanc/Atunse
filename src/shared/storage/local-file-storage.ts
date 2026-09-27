import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_TARGET_TTL_SECONDS, type FileStorage, type UploadTarget } from "./file-storage";

// Development stand-in for S3 so /booking works with no AWS account. It
// mimics a presigned POST: the target carries an HMAC over the key, type,
// size cap and expiry, and POST /api/v1/uploads/local only writes files
// whose fields verify. Never used in production (see ./index.ts).

export const LOCAL_UPLOAD_URL = "/api/v1/uploads/local";

export class LocalUploadRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalUploadRejectedError";
  }
}

function sign(secret: string, fields: { key: string; contentType: string; maxBytes: string; expires: string }): string {
  return createHmac("sha256", secret)
    .update([fields.key, fields.contentType, fields.maxBytes, fields.expires].join("\n"))
    .digest("hex");
}

export class LocalFileStorage implements FileStorage {
  constructor(
    private readonly rootDir: string,
    private readonly secret: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createUploadTarget(params: { key: string; contentType: string; maxBytes: number }): Promise<UploadTarget> {
    const fields = {
      key: params.key,
      contentType: params.contentType,
      maxBytes: String(params.maxBytes),
      expires: String(this.now().getTime() + UPLOAD_TARGET_TTL_SECONDS * 1000),
    };
    return { url: LOCAL_UPLOAD_URL, fields: { ...fields, signature: sign(this.secret, fields) } };
  }

  /** Verifies a form POST built from a target above and writes its file. */
  async receive(form: FormData): Promise<void> {
    const field = (name: string) => {
      const value = form.get(name);
      if (typeof value !== "string") throw new LocalUploadRejectedError(`Missing field: ${name}`);
      return value;
    };
    const fields = { key: field("key"), contentType: field("contentType"), maxBytes: field("maxBytes"), expires: field("expires") };
    const expected = Buffer.from(sign(this.secret, fields), "hex");
    const given = Buffer.from(field("signature"), "hex");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new LocalUploadRejectedError("Invalid signature");
    }
    if (Number(fields.expires) < this.now().getTime()) throw new LocalUploadRejectedError("Upload target expired");

    const file = form.get("file");
    if (!(file instanceof Blob)) throw new LocalUploadRejectedError("Missing file");
    if (file.size === 0 || file.size > Number(fields.maxBytes)) throw new LocalUploadRejectedError("File size not allowed");
    if (file.type !== fields.contentType) throw new LocalUploadRejectedError("Content type mismatch");

    const root = path.resolve(this.rootDir);
    const destination = path.resolve(root, fields.key);
    if (!destination.startsWith(root + path.sep)) throw new LocalUploadRejectedError("Invalid key");
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, Buffer.from(await file.arrayBuffer()));
  }
}
