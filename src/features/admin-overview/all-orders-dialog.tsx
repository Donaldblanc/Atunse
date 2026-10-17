import Link from "next/link";
import { ITEM_STATUSES, ITEM_STATUS_LABELS, type ItemStatus } from "@/features/orders/domain";
import { AdminDialog } from "@/shared/ui/admin-dialog";
import "./find-orders.css";
import { overviewHref, type OverviewSelection } from "./overview-range";
import { OrdersTable } from "./orders-table";
import type { OrderList } from "./search-orders";

/**
 * The dialog behind "View all orders" and the top-bar search
 * (`?orders=all&q=&status=&page=`). The search box is a plain GET form and
 * the tabs and pages are links, so it all works without JavaScript and each
 * state can be linked to. Rows open the Order dialog.
 */
export function AllOrdersDialog({ list, selection, filterLabel = null }: { list: OrderList; selection: OverviewSelection; filterLabel?: string | null }) {
  const { query, rows, total, page, pageCount } = list;
  const hrefFor = (overrides: { status?: ItemStatus | null; page?: number }) => {
    const status = overrides.status === undefined ? query.status : overrides.status;
    const extra: Record<string, string> = { orders: "all" };
    if (query.q) extra.q = query.q;
    if (status) extra.status = status;
    if (query.day) extra.day = query.day;
    if (query.serviceId) extra.service = query.serviceId;
    if (overrides.page && overrides.page > 1) extra.page = String(overrides.page);
    return overviewHref(selection, extra);
  };
  // The form keeps the range, status and day/Service filter; typing a new search starts again at page 1.
  const hidden = [
    ...new URL(
      overviewHref(selection, {
        orders: "all",
        ...(query.status ? { status: query.status } : {}),
        ...(query.day ? { day: query.day } : {}),
        ...(query.serviceId ? { service: query.serviceId } : {}),
      }),
      "http://admin.local",
    ).searchParams,
  ];
  // Clearing the day/Service filter keeps the search and the status tab.
  const clearHref = overviewHref(selection, {
    orders: "all",
    ...(query.q ? { q: query.q } : {}),
    ...(query.status ? { status: query.status } : {}),
  });

  return (
    <AdminDialog title={`All orders (${total})`} closeHref={overviewHref(selection)} size="lg">
      <div className="fo">
        {filterLabel && (
          <p className="fo-filter">
            <span className="fo-filter-chip">{filterLabel}</span>
            <Link className="fo-filter-clear" href={clearHref} scroll={false}>
              Clear filter
            </Link>
          </p>
        )}
        <form action="/admin" method="get" role="search" className="fo-search">
          {hidden.map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
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
          <button type="submit" className="admin-btn">
            Search
          </button>
        </form>

        <nav className="att-tabs" aria-label="Order status">
          <Link className="att-tab" href={hrefFor({ status: null })} scroll={false} aria-current={query.status === null ? "page" : undefined}>
            All
          </Link>
          {ITEM_STATUSES.map((status) => (
            <Link key={status} className="att-tab" href={hrefFor({ status })} scroll={false} aria-current={query.status === status ? "page" : undefined}>
              {ITEM_STATUS_LABELS[status]}
            </Link>
          ))}
        </nav>

        <OrdersTable rows={rows} rowHref={(row) => overviewHref(selection, { order: row.orderId })} scroll={false} />


        {pageCount > 1 && (
          <nav className="fo-pages" aria-label="Pages">
            {page > 1 ? (
              <Link className="admin-btn" data-variant="secondary" href={hrefFor({ page: page - 1 })} scroll={false} rel="prev">
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="ov-cell-sub">
              Page {page} of {pageCount}
            </span>
            {page < pageCount ? (
              <Link className="admin-btn" data-variant="secondary" href={hrefFor({ page: page + 1 })} scroll={false} rel="next">
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </AdminDialog>
  );
}
