// Pure chart arithmetic for the Overview's charts, kept out of the
// components so it can be unit-tested.

/**
 * Y-axis ticks in whole dollars from 0 up past `maxDollars`: four evenly
 * spaced round values (steps of 1, 2, 2.5 or 5 times a power of ten).
 * An empty range still gets a readable $0-$150 axis.
 */
export function dollarTicks(maxDollars: number): number[] {
  const target = Math.max(maxDollars, 100) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= target)!;
  return [0, step, step * 2, step * 3];
}

export interface DonutSegment {
  /** Where the segment starts along the ring, and how long it is, as fractions of the whole ring. */
  offset: number;
  length: number;
}

/** Each value's share of the ring, in order, starting at 12 o'clock. */
export function donutSegments(values: number[]): DonutSegment[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total === 0) return values.map(() => ({ offset: 0, length: 0 }));
  let offset = 0;
  return values.map((value) => {
    const segment = { offset, length: value / total };
    offset += segment.length;
    return segment;
  });
}

/** Whole-number percentages of `values` that always add up to exactly 100 (largest remainders). */
export function sharesOf100(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total === 0) return values.map(() => 0);
  const exact = values.map((value) => (value / total) * 100);
  const shares = exact.map(Math.floor);
  const byRemainder = exact.map((value, i) => ({ i, remainder: value - Math.floor(value) })).sort((a, b) => b.remainder - a.remainder);
  const missing = 100 - shares.reduce((sum, share) => sum + share, 0);
  for (let k = 0; k < missing; k++) shares[byRemainder[k]!.i]! += 1;
  return shares;
}
