import { describe, expect, it } from "vitest";
import { photoKeyContentType, photoMatchesKey, sniffPhotoType } from "./photo-keys";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v])));

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = bytes("RIFF", 0, 0, 0, 0, "WEBPVP8 ");
const HEIC = bytes(0, 0, 0, 0x18, "ftypheic", 0, 0, 0, 0);
const HEIF = bytes(0, 0, 0, 0x18, "ftypmif1", 0, 0, 0, 0);

describe("sniffPhotoType", () => {
  it("recognizes each allowed format by its signature", () => {
    expect(sniffPhotoType(JPEG)).toBe("image/jpeg");
    expect(sniffPhotoType(PNG)).toBe("image/png");
    expect(sniffPhotoType(WEBP)).toBe("image/webp");
    expect(sniffPhotoType(HEIC)).toBe("image/heic");
    expect(sniffPhotoType(HEIF)).toBe("image/heic");
  });

  it("recognizes nothing else", () => {
    expect(sniffPhotoType(bytes("<html><body>"))).toBeNull();
    expect(sniffPhotoType(bytes("%PDF-1.7"))).toBeNull();
    expect(sniffPhotoType(new Uint8Array())).toBeNull();
  });
});

describe("photoMatchesKey", () => {
  it("accepts bytes of the type the key promises, treating HEIC and HEIF as one family", () => {
    expect(photoMatchesKey("bookings/x/0.jpg", JPEG)).toBe(true);
    expect(photoMatchesKey("bookings/x/0.heif", HEIC)).toBe(true);
    expect(photoMatchesKey("bookings/x/0.heic", HEIF)).toBe(true);
  });

  it("rejects bytes of another type, or not an image at all", () => {
    expect(photoMatchesKey("bookings/x/0.png", JPEG)).toBe(false);
    expect(photoMatchesKey("bookings/x/0.jpg", bytes("<script>"))).toBe(false);
    expect(photoKeyContentType("bookings/x/0.gif")).toBeNull();
  });
});
