/** The page's query string, as Next hands it to a server page. */
export type SearchParams = { [key: string]: string | string[] | undefined };

/** The Order the URL asks to see: the first `order` param, or null. */
export function orderIdFromSearchParams(searchParams: SearchParams): string | null {
  const value = Array.isArray(searchParams.order) ? searchParams.order[0] : searchParams.order;
  return value ? value : null;
}
