import { afterEach, describe, expect, it, vi } from "vitest";
import { StorageNotConfiguredError, type FileStorage } from "@/shared/storage";
import { photoUrlOrNull } from "./deps";

const storageWith = (createViewUrl: FileStorage["createViewUrl"]) => () => ({ createViewUrl }) as FileStorage;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("photoUrlOrNull", () => {
  it("returns the view link", async () => {
    await expect(photoUrlOrNull(storageWith(async (key) => `https://bucket/${key}`), "photos/a.jpg")).resolves.toBe("https://bucket/photos/a.jpg");
  });

  it("stays quiet when storage simply isn't configured", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const unconfigured = () => {
      throw new StorageNotConfiguredError("S3_BUCKET and S3_REGION (or AWS_REGION) must be set.");
    };

    await expect(photoUrlOrNull(unconfigured, "photos/a.jpg")).resolves.toBeNull();
    expect(log).not.toHaveBeenCalled();
  });

  it("logs any other failure, redacted, and shows the placeholder", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = storageWith(async () => {
      throw new Error("InvalidAccessKeyId for dj@restoredbydj.com");
    });

    await expect(photoUrlOrNull(failing, "photos/a.jpg")).resolves.toBeNull();
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0]![0]).toContain("InvalidAccessKeyId");
    expect(log.mock.calls[0]![0]).not.toContain("dj@restoredbydj.com");
  });
});
