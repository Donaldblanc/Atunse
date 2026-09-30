import { describe, expect, it } from "vitest";
import { greeting } from "./greeting";

describe("greeting", () => {
  it("follows New York's clock", () => {
    expect(greeting(new Date("2026-09-29T14:00:00Z"))).toBe("Good morning"); // 10 AM EDT
    expect(greeting(new Date("2026-09-29T16:00:00Z"))).toBe("Good afternoon"); // noon
    expect(greeting(new Date("2026-09-29T21:00:00Z"))).toBe("Good evening"); // 5 PM
    expect(greeting(new Date("2026-09-30T03:00:00Z"))).toBe("Good evening"); // 11 PM, already the 30th in UTC
  });
});
