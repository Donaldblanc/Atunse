import { describe, expect, it } from "vitest";
import { overviewHref } from "./overview-href";

describe("overviewHref", () => {
  it("is plain /admin with nothing to keep", () => {
    expect(overviewHref({})).toBe("/admin");
  });

  it("keeps the range params and drops everything else, including an open dialog", () => {
    expect(overviewHref({ range: "last-week", from: "2026-09-01", to: "2026-09-07", visit: "apt_1", junk: "x" })).toBe(
      "/admin?range=last-week&from=2026-09-01&to=2026-09-07",
    );
  });

  it("adds the params that open a dialog", () => {
    expect(overviewHref({ range: "last-30-days" }, { visit: "apt_1" })).toBe("/admin?range=last-30-days&visit=apt_1");
    expect(overviewHref({}, { visit: "a b" })).toBe("/admin?visit=a+b");
  });

  it("ignores repeated or empty values", () => {
    expect(overviewHref({ range: ["a", "b"], from: "" })).toBe("/admin");
  });
});
