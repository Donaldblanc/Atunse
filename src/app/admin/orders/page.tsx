// The standalone Orders screen: the same search, status tabs and paging as
// the Overview's "All orders" dialog (searchOrders), promoted to a full
// page. Rows link to /admin/orders/[id] instead of opening the dialog.

import Link from "next/link";
import { cookies } from "next/headers";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { ITEM_STATUSES, ITEM_STATUS_LABELS, type ItemStatus } from "@/features/orders/domain";
import { buildFindOrdersDeps } from "@/features/admin-overview/find-orders-deps";
import { OrdersTable } from "@/features/admin-overview/orders-table";
import { parseOrdersQuery, searchOrders, type OrdersQuery } from "@/features/admin-overview/search-orders";
import "@/features/admin-overview/find-orders.css";

export const metadata = { title: "Orders · Atunṣe Admin" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** "/admin/orders?..." for `overrides`, keeping the current search text, status, day and Service filter unless replaced. */
function hrefFor(query: OrdersQuery, overrides: { status?: ItemStatus | null; page?: number }): string {
  const status = overrides.status === undefined ? query.status : overrides.status;
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (status) params.set("status", status);
  if (query.day) params.set("day", query.day);
  if (query.serviceId) params.set("service", query.serviceId);
  if (overrides.page && overrides.page > 1) params.set("page", String(overrides.page));
  const search = params.toString();
  return search ? `/admin/orders?${search}` : "/admin/orders";
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actingUser = await actingUserFromCookies(await cookies());
  const query = parseOrdersQuery(params);
  const list = await searchOrders(buildFindOrdersDeps(), actingUser, query);
  const { rows, total, page, pageCount } = list;

  return (
    <div className="ov">
      <div className="ov-header">
        <div>
          <p className="ov-eyebrow">Orders</p>
          <h1 className="ov-title">All orders</h1>
        </div>
      </div>

      <div className="fo">
        <form action="/admin/orders" method="get" role="search" className="fo-search">
          <label htmlFor="fo-q" className="sr-only">
            Search orders
          </label>
          <input
            id="fo-q"
            name="q"
            type="search"
            className="att-search-input"
            maxLength={100}
            defaultValue={query.q}
            placeholder="Order #, name, email or phone"
          />
          {query.status && <input type="hidden" name="status" value={query.status} />}
          {query.day && <input type="hidden" name="day" value={query.day} />}
          {query.serviceId && <input type="hidden" name="service" value={query.serviceId} />}
          <button type="submit" className="admin-btn">
            Search
          </button>
        </form>

        <nav className="att-tabs" aria-label="Order status">
          <Link className="att-tab" href={hrefFor(query, { status: null })} aria-current={query.status === null ? "page" : undefined}>
            All
          </Link>
          {ITEM_STATUSES.map((status) => (
            <Link key={status} className="att-tab" href={hrefFor(query, { status })} aria-current={query.status === status ? "page" : undefined}>
              {ITEM_STATUS_LABELS[status]}
            </Link>
          ))}
        </nav>

        <OrdersTable rows={rows} rowHref={(row) => `/admin/orders/${row.orderId}`} />

        {pageCount > 1 && (
          <nav className="fo-pages" aria-label="Pages">
            {page > 1 ? (
              <Link className="admin-btn" data-variant="secondary" href={hrefFor(query, { page: page - 1 })} rel="prev">
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="ov-cell-sub">
              Page {page} of {pageCount} ({total} order{total === 1 ? "" : "s"})
            </span>
            {page < pageCount ? (
              <Link className="admin-btn" data-variant="secondary" href={hrefFor(query, { page: page + 1 })} rel="next">
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
