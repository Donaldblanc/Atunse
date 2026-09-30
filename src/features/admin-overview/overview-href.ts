// Links within the Overview: a dialog is one more query param on /admin, and
// the range params ride along so opening and closing one never resets the
// range the owner picked.

type SearchParams = { [key: string]: string | string[] | undefined };

/** The params that scope the whole page, kept whichever dialog opens or closes. */
const RANGE_PARAMS = ["range", "from", "to"] as const;

/**
 * "/admin" with the range params from `searchParams` plus `extra` (e.g.
 * `{ visit: id }` to open a dialog; leave it out for the close URL).
 */
export function overviewHref(searchParams: SearchParams, extra: Record<string, string> = {}): string {
  const query = new URLSearchParams();
  for (const name of RANGE_PARAMS) {
    const value = searchParams[name];
    if (typeof value === "string" && value !== "") query.set(name, value);
  }
  for (const [name, value] of Object.entries(extra)) query.set(name, value);
  const search = query.toString();
  return search ? `/admin?${search}` : "/admin";
}
