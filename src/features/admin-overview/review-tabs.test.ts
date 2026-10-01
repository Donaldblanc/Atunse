import { describe, expect, it } from "vitest";
import { parseReviewTab } from "./review-tabs";

describe("parseReviewTab", () => {
  it("reads a known tab", () => expect(parseReviewTab("published")).toBe("PUBLISHED"));
  it("falls back to PENDING for anything else", () => {
    expect(parseReviewTab(undefined)).toBe("PENDING");
    expect(parseReviewTab("PUBLISHED")).toBe("PENDING");
    expect(parseReviewTab(["hidden"])).toBe("PENDING");
    expect(parseReviewTab("bogus")).toBe("PENDING");
  });
});
