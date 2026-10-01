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

/**
 * How a chart with one column per day labels and tabs through its days.
 * A week labels every day; up to a month, every fifth day; beyond that
 * (90 days, a custom range) about six labels, so they never run into each
 * other. Past 45 days a column is a sliver, so it gets no tab stop (hover
 * still shows the value, and every column keeps its aria-label).
 */
export function dayAxis(dayCount: number): { everyDay: boolean; labelStep: number; veryDense: boolean } {
  const everyDay = dayCount <= 7;
  return {
    everyDay,
    labelStep: everyDay ? 1 : dayCount <= 31 ? 5 : Math.ceil(dayCount / 6),
    veryDense: dayCount > 45,
  };
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

/** Y-axis ticks for a count: four whole numbers from 0 up to at least `max` (never a fractional order). */
export function countTicks(max: number): number[] {
  const step = Math.max(1, Math.ceil(max / 3));
  const magnitude = 10 ** Math.floor(Math.log10(step));
  const rounded = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= step)!;
  return [0, rounded, rounded * 2, rounded * 3];
}
