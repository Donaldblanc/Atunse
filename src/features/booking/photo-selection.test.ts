import { describe, expect, it } from "vitest";
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_ITEM } from "@/features/orders/photo-keys";
import { PHOTO_ACCEPT, selectPhotos, skippedMessage } from "./photo-selection";

function photo(name: string, type = "image/jpeg", size = 100): File {
  const file = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("selectPhotos", () => {
  it("keeps allowed photos and appends them to what's already picked", () => {
    const existing = [photo("a.jpg")];
    const { photos, skipped } = selectPhotos(existing, [photo("b.png", "image/png"), photo("c.heic", "image/heic")]);
    expect(photos.map((p) => p.name)).toEqual(["a.jpg", "b.png", "c.heic"]);
    expect(skipped).toEqual([]);
  });

  it("skips types and sizes the server rejects, saying why", () => {
    const { photos, skipped } = selectPhotos(
      [],
      [photo("anim.gif", "image/gif"), photo("big.jpg", "image/jpeg", MAX_PHOTO_BYTES + 1), photo("ok.jpg")],
    );
    expect(photos.map((p) => p.name)).toEqual(["ok.jpg"]);
    expect(skipped).toEqual([
      { name: "anim.gif", reason: "isn't a JPEG, PNG, WebP or HEIC image" },
      { name: "big.jpg", reason: "is over 15 MB" },
    ]);
  });

  it("caps the total at the per-pair photo limit", () => {
    const existing = Array.from({ length: MAX_PHOTOS_PER_ITEM - 1 }, (_, i) => photo(`${i}.jpg`));
    const { photos, skipped } = selectPhotos(existing, [photo("last.jpg"), photo("extra.jpg")]);
    expect(photos).toHaveLength(MAX_PHOTOS_PER_ITEM);
    expect(skipped).toEqual([{ name: "extra.jpg", reason: "is over the 10-photo limit" }]);
  });
});

describe("skippedMessage", () => {
  it("is null when nothing was skipped and lists each file otherwise", () => {
    expect(skippedMessage([])).toBeNull();
    expect(skippedMessage([{ name: "a.gif", reason: "isn't a JPEG, PNG, WebP or HEIC image" }])).toBe(
      "Skipped a.gif (isn't a JPEG, PNG, WebP or HEIC image).",
    );
  });
});

it("offers only the allowed types in the file picker", () => {
  expect(PHOTO_ACCEPT).toBe("image/jpeg,image/png,image/webp,image/heic,image/heif");
});
