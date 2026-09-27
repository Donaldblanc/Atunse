import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { S3Client } from "@aws-sdk/client-s3";
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

  it("serves a file only through an unexpired, untampered view link", async () => {
    const { fields } = await target();
    await storage.receive(formFrom(fields, jpeg()));

    const link = new URL(await storage.createViewUrl("bookings/b/0.jpg"), "http://localhost");
    const file = await storage.read(link.searchParams);
    expect(file.contentType).toBe("image/jpeg");
    expect(file.body.length).toBe(3);

    const tampered = new URLSearchParams(link.searchParams);
    tampered.set("key", "bookings/b/1.jpg");
    await expect(storage.read(tampered)).rejects.toThrow(/Invalid signature/);

    // An upload signature must never work as a view link.
    const forged = new URLSearchParams({ key: fields.key!, expires: fields.expires!, signature: fields.signature! });
    await expect(storage.read(forged)).rejects.toThrow(/Invalid signature/);

    now = new Date(now.getTime() + 6 * 60 * 1000);
    await expect(storage.read(link.searchParams)).rejects.toThrow(/expired/);
  });

  it("inspects what was actually uploaded: size, type and first bytes; null when nothing is there", async () => {
    const { fields } = await target();
    await storage.receive(formFrom(fields, jpeg(3)));
    const stored = await storage.inspect("bookings/b/0.jpg");
    expect(stored).toMatchObject({ size: 3, contentType: "image/jpeg" });
    expect(stored?.head.length).toBe(3);
    expect(await storage.inspect("bookings/b/9.jpg")).toBeNull();
  });

  it("refuses a correctly signed key that escapes the upload directory", async () => {
    const { fields } = await storage.createUploadTarget({ key: "../escape.jpg", contentType: "image/jpeg", maxBytes: 10 });
    await expect(storage.receive(formFrom(fields, jpeg()))).rejects.toThrow(/Invalid key/);
  });
});

describe("S3FileStorage", () => {
  it("issues a presigned POST pinned to the key and content type", async () => {
    const storage = new S3FileStorage({
      bucket: "atunse-test",
      region: "us-east-1",
      credentials: { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "secret" },
    });
    const { url, fields } = await storage.createUploadTarget({ key: "bookings/b/0.jpg", contentType: "image/jpeg", maxBytes: 10 });

    expect(url).toContain("atunse-test");
    expect(fields.key).toBe("bookings/b/0.jpg");
    expect(fields["Content-Type"]).toBe("image/jpeg");
    const policy = JSON.parse(Buffer.from(fields.Policy!, "base64").toString());
    expect(policy.conditions).toContainEqual(["content-length-range", 1, 10]);
  });

  it("issues a short-lived presigned GET for viewing, path-style on a custom endpoint", async () => {
    const storage = new S3FileStorage({
      bucket: "atunse-images",
      region: "us-east-2",
      endpoint: "https://storage.example.test",
      credentials: { accessKeyId: "nak_example", secretAccessKey: "secret" },
    });
    const url = new URL(await storage.createViewUrl("bookings/b/0.jpg"));
    expect(url.origin + url.pathname).toBe("https://storage.example.test/atunse-images/bookings/b/0.jpg");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
  });

  it("addresses an S3-compatible endpoint path-style, since bucket subdomains don't resolve there", async () => {
    const storage = new S3FileStorage({
      bucket: "atunse-images",
      region: "us-east-2",
      endpoint: "https://storage.example.test",
      credentials: { accessKeyId: "nak_example", secretAccessKey: "secret" },
    });
    const { url } = await storage.createUploadTarget({ key: "bookings/b/0.jpg", contentType: "image/jpeg", maxBytes: 10 });
    expect(url).toBe("https://storage.example.test/atunse-images");
  });
});

describe("getFileStorage", () => {
  it("defaults to local storage in development", () => {
    expect(getFileStorage({ NODE_ENV: "development", SESSION_SECRET: "s" })).toBeInstanceOf(LocalFileStorage);
  });

  it("uses S3 when configured", () => {
    expect(getFileStorage({ NODE_ENV: "production", S3_BUCKET: "b", S3_REGION: "us-east-1" })).toBeInstanceOf(S3FileStorage);
  });

  it("treats a blank STORAGE_DRIVER as unset", () => {
    expect(getFileStorage({ NODE_ENV: "development", STORAGE_DRIVER: "", SESSION_SECRET: "s" })).toBeInstanceOf(
      LocalFileStorage,
    );
    expect(getFileStorage({ NODE_ENV: "production", STORAGE_DRIVER: " ", S3_BUCKET: "b", S3_REGION: "r" })).toBeInstanceOf(
      S3FileStorage,
    );
  });

  it("prefers S3_* over AWS_* when both are set", async () => {
    const storage = getFileStorage({
      NODE_ENV: "production",
      S3_BUCKET: "b",
      S3_REGION: "us-east-1",
      AWS_REGION: "us-west-2",
      S3_ACCESS_KEY_ID: "s3-key",
      S3_SECRET_ACCESS_KEY: "s3-secret",
      AWS_ACCESS_KEY_ID: "aws-key",
      AWS_SECRET_ACCESS_KEY: "aws-secret",
    }) as unknown as { client: S3Client };
    const credentials = await storage.client.config.credentials();
    expect(credentials.accessKeyId).toBe("s3-key");
    expect(credentials.secretAccessKey).toBe("s3-secret");
    expect(await storage.client.config.region()).toBe("us-east-1");
  });

  it("never pairs half an S3_* credential with an AWS_* one", () => {
    expect(() =>
      getFileStorage({
        NODE_ENV: "production",
        S3_BUCKET: "b",
        S3_REGION: "us-east-1",
        S3_ACCESS_KEY_ID: "s3-key",
        AWS_ACCESS_KEY_ID: "aws-key",
        AWS_SECRET_ACCESS_KEY: "aws-secret",
      }),
    ).toThrow(StorageNotConfiguredError);
  });

  it("accepts Neon storage's AWS_* variable names", async () => {
    const storage = getFileStorage({
      NODE_ENV: "production",
      S3_BUCKET: "atunse-images",
      AWS_REGION: "us-east-2",
      AWS_ENDPOINT_URL_S3: "https://storage.example.test",
      AWS_ACCESS_KEY_ID: "nak_example",
      AWS_SECRET_ACCESS_KEY: "secret",
    });
    const { url } = await storage.createUploadTarget({ key: "bookings/b/0.jpg", contentType: "image/jpeg", maxBytes: 10 });
    expect(url).toBe("https://storage.example.test/atunse-images");
  });

  it("fails loudly in production without S3 config, and never falls back to local disk", () => {
    expect(() => getFileStorage({ NODE_ENV: "production" })).toThrow(StorageNotConfiguredError);
    expect(() => getFileStorage({ NODE_ENV: "production", STORAGE_DRIVER: "local", SESSION_SECRET: "s" })).toThrow(
      StorageNotConfiguredError,
    );
  });
});
