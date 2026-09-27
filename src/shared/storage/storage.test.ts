import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getFileStorage, StorageNotConfiguredError } from ".";
import { LocalFileStorage, LocalUploadRejectedError } from "./local-file-storage";
import { S3FileStorage } from "./s3-file-storage";

function formFrom(fields: Record<string, string>, file: Blob | null): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  if (file) form.append("file", file);
  return form;
}

const jpeg = (bytes = 3) => new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });

describe("LocalFileStorage", () => {
  let root: string;
  let now: Date;
  let storage: LocalFileStorage;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "atunse-uploads-"));
    now = new Date("2026-10-01T15:00:00Z");
    storage = new LocalFileStorage(root, "test-secret", () => now);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const target = () => storage.createUploadTarget({ key: "bookings/b/0.jpg", contentType: "image/jpeg", maxBytes: 10 });

  it("writes a file whose form matches the issued target", async () => {
    const { fields } = await target();
    await storage.receive(formFrom(fields, jpeg()));
    expect((await readFile(path.join(root, "bookings/b/0.jpg"))).length).toBe(3);
  });

  it("rejects a tampered key, an expired target, a wrong type and an oversized file", async () => {
    const { fields } = await target();
    await expect(storage.receive(formFrom({ ...fields, key: "bookings/b/1.jpg" }, jpeg()))).rejects.toThrow(
      LocalUploadRejectedError,
    );
    await expect(storage.receive(formFrom(fields, new Blob(["x"], { type: "text/html" })))).rejects.toThrow(
      LocalUploadRejectedError,
    );
    await expect(storage.receive(formFrom(fields, jpeg(11)))).rejects.toThrow(LocalUploadRejectedError);

    now = new Date(now.getTime() + 11 * 60 * 1000);
    await expect(storage.receive(formFrom(fields, jpeg()))).rejects.toThrow(/expired/);
  });

  it("refuses a correctly signed key that escapes the upload directory", async () => {
    const { fields } = await storage.createUploadTarget({ key: "../escape.jpg", contentType: "image/jpeg", maxBytes: 10 });
    await expect(storage.receive(formFrom(fields, jpeg()))).rejects.toThrow(/Invalid key/);
  });
});

describe("S3FileStorage", () => {
  it("issues a presigned POST pinned to the key and content type", async () => {
    const storage = new S3FileStorage("atunse-test", "us-east-1", { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "secret" });
    const { url, fields } = await storage.createUploadTarget({ key: "bookings/b/0.jpg", contentType: "image/jpeg", maxBytes: 10 });

    expect(url).toContain("atunse-test");
    expect(fields.key).toBe("bookings/b/0.jpg");
    expect(fields["Content-Type"]).toBe("image/jpeg");
    const policy = JSON.parse(Buffer.from(fields.Policy!, "base64").toString());
    expect(policy.conditions).toContainEqual(["content-length-range", 1, 10]);
  });
});

describe("getFileStorage", () => {
  it("defaults to local storage in development", () => {
    expect(getFileStorage({ NODE_ENV: "development", SESSION_SECRET: "s" })).toBeInstanceOf(LocalFileStorage);
  });

  it("uses S3 when configured", () => {
    expect(getFileStorage({ NODE_ENV: "production", S3_BUCKET: "b", S3_REGION: "us-east-1" })).toBeInstanceOf(S3FileStorage);
  });

  it("fails loudly in production without S3 config, and never falls back to local disk", () => {
    expect(() => getFileStorage({ NODE_ENV: "production" })).toThrow(StorageNotConfiguredError);
    expect(() => getFileStorage({ NODE_ENV: "production", STORAGE_DRIVER: "local", SESSION_SECRET: "s" })).toThrow(
      StorageNotConfiguredError,
    );
  });
});
