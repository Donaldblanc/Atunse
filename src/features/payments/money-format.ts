// The Payments screen formats dollar amounts with thousands separators
// ("$3,850"), unlike Money.format() elsewhere in the admin.

import type { Money } from "@/shared/money/money";

export function formatDollars(amount: Money): string {
  const dollars = amount.cents / 100;
  const digits = amount.cents % 100 === 0 ? 0 : 2;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
