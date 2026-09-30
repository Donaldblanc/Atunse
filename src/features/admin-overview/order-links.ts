/** The page's query string, as Next hands it to a server page. */
export type SearchParams = { [key: string]: string | string[] | undefined };

/**
 * The Overview URL with `order` set (opening that Order's detail dialog) or
 * removed (closing it), keeping every other param, such as the range.
 * Recent Orders, Today's Schedule and Pending Payments all link with this.
 */
export function overviewHref(searchParams: SearchParams, orderId: string | null): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "order") continue;
    for (const one of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, one);
  }
  if (orderId) query.set("order", orderId);
  const search = query.toString();
  return search ? `/admin?${search}` : "/admin";
}

/** The Order the URL asks to see: the first `order` param, or null. */
export function orderIdFromSearchParams(searchParams: SearchParams): string | null {
  const value = Array.isArray(searchParams.order) ? searchParams.order[0] : searchParams.order;
  return value ? value : null;
}
