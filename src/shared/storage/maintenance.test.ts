import { describe, expect, it } from "vitest";
import { assertDatabaseMatchesBucket, corsRulesFor, selectOrphans } from "./maintenance";

describe("corsRulesFor", () => {
  it("allows only POST, from the given origins, deduplicated and without trailing slashes", () => {
    const [rule] = corsRulesFor(["https://atunse.com/", " https://atunse.com", "https://*.vercel.app", "http://localhost:3000"]);
    expect(rule).toMatchObject({
      AllowedOrigins: ["https://atunse.com", "https://*.vercel.app", "http://localhost:3000"],
      AllowedMethods: ["POST"],
    });
  });

  it("refuses no origins, wildcards that match more than one site's subdomains, and plain http outside localhost", () => {
    expect(() => corsRulesFor([""])).toThrow();
    for (const origin of ["*", "https://*", "https://*.*", "https://*.com", "https://atunse.*"]) {
      expect(() => corsRulesFor([origin]), origin).toThrow();
    }
    expect(() => corsRulesFor(["http://atunse.com"])).toThrow();
  });
});

describe("selectOrphans", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3_600_000);

  it("picks unreferenced uploads and copies older than the cutoff, and nothing else", () => {
    const objects = [
      { key: "bookings/a/0.jpg", lastModified: at(72) }, // upload, copied or abandoned
      { key: "photos/x/0.jpg", lastModified: at(72) }, // an Order's copy
      { key: "photos/y/0.jpg", lastModified: at(72) }, // copy from a booking that failed after copying
      { key: "bookings/b/0.jpg", lastModified: at(72) }, // pre-#77 Order photo (key = upload key)
      { key: "bookings/c/0.jpg", lastModified: at(2) }, // a booking may still be in progress
      { key: "other/d.jpg", lastModified: at(72) }, // not a booking photo
    ];
    const referenced = new Set(["photos/x/0.jpg", "bookings/b/0.jpg"]);
    expect(selectOrphans(objects, referenced, now).map((o) => o.key)).toEqual(["bookings/a/0.jpg", "photos/y/0.jpg"]);
  });
});

describe("assertDatabaseMatchesBucket", () => {
  it("refuses when the bucket has photos but none of the database's are among them", () => {
    const bucket = new Set(["photos/prod/0.jpg", "photos/prod/1.jpg"]);
    expect(() => assertDatabaseMatchesBucket(bucket, new Set(["photos/dev/0.jpg"]))).toThrow(/wrong database/);
    expect(() => assertDatabaseMatchesBucket(bucket, new Set())).toThrow(/wrong database/);
  });

  it("allows a matching pair, and an empty bucket", () => {
    expect(() => assertDatabaseMatchesBucket(new Set(["photos/p/0.jpg"]), new Set(["photos/p/0.jpg"]))).not.toThrow();
    expect(() => assertDatabaseMatchesBucket(new Set(), new Set(["photos/p/0.jpg"]))).not.toThrow();
  });
});
