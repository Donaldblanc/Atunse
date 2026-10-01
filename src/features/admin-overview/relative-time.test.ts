import { describe, expect, it } from "vitest";
import { relativeTime } from "./relative-time";

const NOW = new Date("2026-10-01T15:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("relativeTime", () => {
  it("counts minutes, hours and days, then falls back to the date", () => {
    expect(relativeTime(ago(20_000), NOW)).toBe("just now");
    expect(relativeTime(ago(5 * 60_000), NOW)).toBe("5 min ago");
    expect(relativeTime(ago(3 * 3_600_000), NOW)).toBe("3 h ago");
    expect(relativeTime(ago(2 * 86_400_000), NOW)).toBe("2 d ago");
    expect(relativeTime(ago(10 * 86_400_000), NOW)).toBe("Sep 21");
  });
});
