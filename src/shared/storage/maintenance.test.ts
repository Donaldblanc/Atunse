import { describe, expect, it } from "vitest";
import { corsRulesFor, selectOrphans } from "./maintenance";

describe("corsRulesFor", () => {
  it("allows only POST, from the given origins, deduplicated and without trailing slashes", () => {
    const [rule] = corsRulesFor(["https://atunse.com/", " https://atunse.com", "https://*.vercel.app", "http://localhost:3000"]);
    expect(rule).toMatchObject({
      AllowedOrigins: ["https://atunse.com", "https://*.vercel.app", "http://localhost:3000"],
      AllowedMethods: ["POST"],
    });
  });

  it("refuses no origins, a wildcard-everything origin, and plain http outside localhost", () => {
    expect(() => corsRulesFor([""])).toThrow();
    expect(() => corsRulesFor(["*"])).toThrow();
    expect(() => corsRulesFor(["http://atunse.com"])).toThrow();
  });
});

describe("selectOrphans", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3_600_000);

  it("picks unattached booking photos older than the cutoff, and nothing else", () => {
    const objects = [
      { key: "bookings/a/0.jpg", lastModified: at(72) }, // orphan
      { key: "bookings/b/0.jpg", lastModified: at(72) }, // attached to an order
      { key: "bookings/c/0.jpg", lastModified: at(2) }, // a booking may still be in progress
      { key: "other/d.jpg", lastModified: at(72) }, // not a booking photo
    ];
    expect(selectOrphans(objects, new Set(["bookings/b/0.jpg"]), now).map((o) => o.key)).toEqual(["bookings/a/0.jpg"]);
  });
});
