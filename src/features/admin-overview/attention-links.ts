// URLs for the Overview's Needs Attention panels. The range picker's params
// ride along on every link so opening or closing a panel never changes the
// range the owner picked.

export type OverviewSearchParams = { [key: string]: string | string[] | undefined };

const RANGE_PARAMS = ["range", "from", "to"];

function firstValue(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

/** `/admin` with only the range params of `params`, plus `extra`. */
export function overviewHref(params: OverviewSearchParams, extra: Record<string, string> = {}): string {
  const next = new URLSearchParams();
  for (const key of RANGE_PARAMS) {
    const value = firstValue(params[key]);
    if (value !== null) next.set(key, value);
  }
  for (const [key, value] of Object.entries(extra)) next.set(key, value);
  const query = next.toString();
  return query ? `/admin?${query}` : "/admin";
}

/** Opens a panel over the Overview. */
export function attentionHref(params: OverviewSearchParams, panel: string): string {
  return overviewHref(params, { attention: panel });
}

/** Opens an Order's dialog (`?order=`), leaving the panel behind. */
export function orderHref(params: OverviewSearchParams, orderId: string): string {
  return overviewHref(params, { order: orderId });
}

/** The Overview with a panel closed: every other param stays. */
export function closeAttentionHref(params: OverviewSearchParams): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = firstValue(value);
    if (key !== "attention" && single !== null) next.set(key, single);
  }
  const query = next.toString();
  return query ? `/admin?${query}` : "/admin";
}
