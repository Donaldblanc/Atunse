import { describe, expect, it } from "vitest";
import { formatList } from "./format-list";

describe("formatList", () => {
  it("returns an empty string for an empty list", () => {
    expect(formatList([])).toBe("");
  });

  it("returns the item itself for a single-item list", () => {
    expect(formatList(["name"])).toBe("name");
  });

  it("joins two items with 'and', no comma", () => {
    expect(formatList(["name", "email"])).toBe("name and email");
  });

  it("joins three or more items with an Oxford comma before 'and'", () => {
    expect(formatList(["name", "email", "phone"])).toBe("name, email, and phone");
  });

  it("works for pair numbers too", () => {
    expect(formatList(["1", "3"])).toBe("1 and 3");
    expect(formatList(["1", "2", "3"])).toBe("1, 2, and 3");
  });
});
