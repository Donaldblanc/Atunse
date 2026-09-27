import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./concurrency";

describe("mapWithConcurrency", () => {
  it("keeps input order and never runs more than the limit at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const results = await mapWithConcurrency(Array.from({ length: 30 }, (_, i) => i), 10, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, (n * 7) % 5));
      inFlight -= 1;
      return n * 2;
    });
    expect(results).toEqual(Array.from({ length: 30 }, (_, i) => i * 2));
    expect(peak).toBe(10);
  });

  it("handles an empty list and a limit larger than the list", async () => {
    expect(await mapWithConcurrency([], 10, async (n: number) => n)).toEqual([]);
    expect(await mapWithConcurrency([1, 2], 10, async (n) => n + 1)).toEqual([2, 3]);
  });
});
