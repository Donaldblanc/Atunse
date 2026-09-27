import { createHmac, timingSafeEqual } from "node:crypto";
import { copyFile, mkdir, open, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  INSPECT_HEAD_BYTES,
  UPLOAD_TARGET_TTL_SECONDS,
  VIEW_URL_TTL_SECONDS,
  type FileStorage,
  type StoredObject,
  type UploadTarget,
} from "./file-storage";

// Development stand-in for S3 so /booking works with no AWS account. It
// mimics a presigned POST: the target carries an HMAC over the key, type,
// size cap and expiry, and POST /api/v1/uploads/local only writes files
// whose fields verify; view links (createViewUrl) are signed the same way
// and served by GET on that route. Never used in production (see ./index.ts).

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

// Distinct prefix, so an upload signature can never pass as a view link.
function signView(secret: string, key: string, expires: string): string {
  return createHmac("sha256", secret).update(["view", key, expires].join("\n")).digest("hex");
}

function signaturesMatch(given: string, expectedHex: string): boolean {
  const a = Buffer.from(given, "hex");
  const b = Buffer.from(expectedHex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Like S3's object metadata, each file's Content-Type (the one its upload
// target pinned) is kept beside it, in "<file>.content-type".
const CONTENT_TYPE_SUFFIX = ".content-type";

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

  async createViewUrl(key: string): Promise<string> {
    const expires = String(this.now().getTime() + VIEW_URL_TTL_SECONDS * 1000);
    const query = new URLSearchParams({ key, expires, signature: signView(this.secret, key, expires) });
    return `${LOCAL_UPLOAD_URL}?${query}`;
  }

  async inspect(key: string): Promise<StoredObject | null> {
    let file;
    try {
      file = await open(this.resolveKey(key), "r");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
    try {
      const { size } = await file.stat();
      const buffer = Buffer.alloc(Math.min(INSPECT_HEAD_BYTES, size));
      await file.read(buffer, 0, buffer.length, 0);
      return { size, contentType: await this.storedContentType(key), head: new Uint8Array(buffer) };
    } finally {
      await file.close();
    }
  }

  /** Verifies a view link from createViewUrl and reads its file. */
  async read(params: URLSearchParams): Promise<{ body: Buffer; contentType: string }> {
    const key = params.get("key") ?? "";
    const expires = params.get("expires") ?? "";
    if (!signaturesMatch(params.get("signature") ?? "", signView(this.secret, key, expires))) {
      throw new LocalUploadRejectedError("Invalid signature");
    }
    if (Number(expires) < this.now().getTime()) throw new LocalUploadRejectedError("View link expired");
    const destination = this.resolveKey(key);
    return { body: await readFile(destination), contentType: (await this.storedContentType(key)) ?? "application/octet-stream" };
  }

  async copy(fromKey: string, toKey: string): Promise<boolean> {
    const from = this.resolveKey(fromKey);
    const to = this.resolveKey(toKey);
    try {
      await mkdir(path.dirname(to), { recursive: true });
      await copyFile(from, to);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw err;
    }
    const contentType = await this.storedContentType(fromKey);
    if (contentType) await writeFile(to + CONTENT_TYPE_SUFFIX, contentType);
    return true;
  }

  private async storedContentType(key: string): Promise<string | null> {
    try {
      return (await readFile(this.resolveKey(key) + CONTENT_TYPE_SUFFIX, "utf8")).trim() || null;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  private resolveKey(key: string): string {
    const root = path.resolve(this.rootDir);
    const destination = path.resolve(root, key);
    if (!destination.startsWith(root + path.sep)) throw new LocalUploadRejectedError("Invalid key");
    return destination;
  }

  /** Verifies a form POST built from a target above and writes its file. */
  async receive(form: FormData): Promise<void> {
    const field = (name: string) => {
      const value = form.get(name);
      if (typeof value !== "string") throw new LocalUploadRejectedError(`Missing field: ${name}`);
      return value;
    };
    const fields = { key: field("key"), contentType: field("contentType"), maxBytes: field("maxBytes"), expires: field("expires") };
    if (!signaturesMatch(field("signature"), sign(this.secret, fields))) {
      throw new LocalUploadRejectedError("Invalid signature");
    }
    if (Number(fields.expires) < this.now().getTime()) throw new LocalUploadRejectedError("Upload target expired");

    const file = form.get("file");
    if (!(file instanceof Blob)) throw new LocalUploadRejectedError("Missing file");
    if (file.size === 0 || file.size > Number(fields.maxBytes)) throw new LocalUploadRejectedError("File size not allowed");
    if (file.type !== fields.contentType) throw new LocalUploadRejectedError("Content type mismatch");

    const destination = this.resolveKey(fields.key);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, Buffer.from(await file.arrayBuffer()));
    await writeFile(destination + CONTENT_TYPE_SUFFIX, fields.contentType);
  }
}
