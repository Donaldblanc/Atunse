import { describe, expect, it } from "vitest";
import type { FileStorage } from "@/shared/storage";
import { isBookingPhotoKey, MAX_PHOTO_BYTES } from "../photo-keys";
import { requestPhotoUploads } from "./request-photo-uploads";
import { BookingValidationError } from "./submit-order";

const storage: FileStorage = {
  async createUploadTarget({ key }) {
    return { url: "https://storage.test/upload", fields: { key } };
  },
  async createViewUrl(key) {
    return `https://storage.test/view/${key}`;
  },
};
const deps = { storage, newBatchId: () => "0b6e8c1e-3f7a-4c2d-9e1b-5a4f3c2d1e0f" };
const guest = { accountId: null, role: "GUEST" as const };

describe("requestPhotoUploads", () => {
  it("mints one key submitOrder will accept per photo", async () => {
    const uploads = await requestPhotoUploads(deps, guest, [
      { contentType: "image/jpeg", size: 1000 },
      { contentType: "image/heic", size: 2000 },
    ]);
    expect(uploads.map((u) => u.key)).toEqual([
      "bookings/0b6e8c1e-3f7a-4c2d-9e1b-5a4f3c2d1e0f/0.jpg",
      "bookings/0b6e8c1e-3f7a-4c2d-9e1b-5a4f3c2d1e0f/1.heic",
    ]);
    expect(uploads.every((u) => isBookingPhotoKey(u.key))).toBe(true);
    expect(uploads[0]?.url).toBe("https://storage.test/upload");
  });

  it.each([
    ["no files", []],
    ["a non-image", [{ contentType: "application/pdf", size: 10 }]],
    ["an oversized photo", [{ contentType: "image/png", size: MAX_PHOTO_BYTES + 1 }]],
    ["too many photos", Array.from({ length: 11 }, () => ({ contentType: "image/png", size: 10 }))],
  ])("rejects %s", async (_label, files) => {
    await expect(requestPhotoUploads(deps, guest, files)).rejects.toThrow(BookingValidationError);
  });
});
