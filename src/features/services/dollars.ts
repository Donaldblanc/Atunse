/**
 * A price typed into a catalog form ("85", "85.5", "85.00") as integer
 * cents, or NaN for anything else, which the use-cases then reject as a
 * validation error. Strict on purpose: blank is not $0, and Number()'s
 * hex ("0x10"), exponent ("1e3") and "Infinity" forms never get through.
 * A leading-dot value (".5", which type=number allows) is accepted. Blank is
 * NaN unless `blankIsZero` (for optional fields like the suede upcharge).
 */
export function parseDollarsToCents(raw: string, options: { blankIsZero?: boolean } = {}): number {
  const trimmed = raw.trim();
  if (trimmed === "" && options.blankIsZero) return 0;
  if (!/^(\d{1,6}(\.\d{1,2})?|\.\d{1,2})$/.test(trimmed)) return NaN;
  return Math.round(Number(trimmed) * 100);
}
