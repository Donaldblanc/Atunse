import { MAX_QUOTE_CENTS } from "@/features/orders/domain";
import { Money } from "@/shared/money/money";

/**
 * A price the owner typed in dollars ("125", "$1,250.50") as integer cents
 * (ADR-0012: money is never a float), or an error message for the form.
 * Whole dollars or exactly up to two decimals; nothing else, so "12.345" or
 * "1e3" is refused rather than rounded into a price the customer is emailed.
 */
export function parseQuotePrice(input: string): { ok: true; cents: number } | { ok: false; error: string } {
  const trimmed = input.trim().replace(/^\$/, "");
  // Commas only as thousands separators: "12,5" is a typo, not $125.
  const text = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(trimmed) ? trimmed.replace(/,/g, "") : trimmed;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { ok: false, error: "Enter the price in dollars, like 125 or 125.50." };
  const [dollars, fraction = ""] = text.split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  if (cents <= 0) return { ok: false, error: "Enter a price above $0." };
  if (cents > MAX_QUOTE_CENTS) return { ok: false, error: `Enter a price of ${Money.fromCents(MAX_QUOTE_CENTS).format()} or less.` };
  return { ok: true, cents };
}

/** Cents as the text a price field starts with: "125" or "125.50". */
export function centsToPriceField(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
