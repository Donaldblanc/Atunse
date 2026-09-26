// "a" / "a and b" / "a, b, and c" — used by ContactStep and DetailsStep's
// validation warnings so missing-field/missing-pair lists read as English
// instead of a bare comma join.
export function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
