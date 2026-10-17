/**
 * A price typed into a catalog form ("85", "85.5", "85.00") as integer
 * cents, or NaN for anything else, which the use-cases then reject as a
 * validation error. Strict on purpose: blank is not $0, and Number()'s
 * hex ("0x10"), exponent ("1e3") and "Infinity" forms never get through.
 */
export function parseDollarsToCents(raw: string): number {
  const trimmed = raw.trim();
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(trimmed)) return NaN;
  return Math.round(Number(trimmed) * 100);
}
