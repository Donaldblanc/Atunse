import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BEFORE_AFTER_IMAGES } from "./gallery";

const LANDING_DIR = path.join(process.cwd(), "public/images/landing");

/** JPEG width/height from the first SOF marker. */
function jpegSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1]!;
    const length = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + length;
  }
  throw new Error(`no SOF marker in ${file}`);
}

describe("before/after gallery", () => {
  it.each(BEFORE_AFTER_IMAGES.map((img) => [img.caption, img] as const))("%s has both photos, cropped as a matching portrait pair", (_c, img) => {
    const before = path.join(LANDING_DIR, img.beforeKey);
    const after = path.join(LANDING_DIR, img.afterKey);
    expect(existsSync(before), img.beforeKey).toBe(true);
    expect(existsSync(after), img.afterKey).toBe(true);
    for (const file of [before, after]) {
      const { width, height } = jpegSize(file);
      expect(width / height).toBeGreaterThan(0.5);
      expect(width / height).toBeLessThan(0.62);
    }
  });

  it("prices each Service line from the catalog, including a part's own price", () => {
    const lines = Object.fromEntries(BEFORE_AFTER_IMAGES.map((img) => [img.caption, img.serviceLine]));
    expect(lines["Air Jordan 5"]).toBe("Oxidation Restoration · Sole from $40+");
    expect(lines['Air Jordan 3 "Black Cement"']).toBe("Oxidation Restoration · From $25+");
    expect(lines['Air Jordan 4 "Military Black"']).toBe("Shoe Lace Replacement");
  });
});
