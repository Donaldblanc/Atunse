import { describe, expect, it } from "vitest";
import { pairPhoto } from "./pair-photo";

describe("pairPhoto", () => {
  const link = async (key: string) => `https://photos.test/${key}`;

  it("is none when the pair has no photo, and never asks for a link", async () => {
    let asked = false;
    expect(await pairPhoto(undefined, async () => ((asked = true), null))).toEqual({ kind: "none" });
    expect(asked).toBe(false);
  });

  it("is stored with its link", async () => {
    expect(await pairPhoto("photos/a.jpg", link)).toEqual({ kind: "stored", url: "https://photos.test/photos/a.jpg" });
  });

  it("is stored without a link when one can't be made: a photo exists, it just can't be shown", async () => {
    expect(await pairPhoto("photos/a.jpg", async () => null)).toEqual({ kind: "stored", url: null });
  });
});
