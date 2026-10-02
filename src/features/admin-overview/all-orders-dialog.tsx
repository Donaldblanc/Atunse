import Link from "next/link";
import { ITEM_STATUSES, ITEM_STATUS_LABELS, type ItemStatus } from "@/features/orders/domain";
import { AdminDialog } from "@/shared/ui/admin-dialog";
import "./find-orders.css";
import { overviewHref, type OverviewSelection } from "./overview-range";
import { DepositCell } from "./recent-orders";
import type { OrderList } from "./search-orders";
import { STATUS_TONE } from "./status-tone";

const bookedDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

/**
 * The dialog behind "View all orders" and the top-bar search
 * (`?orders=all&q=&status=&page=`). The search box is a plain GET form and
 * the tabs and pages are links, so it all works without JavaScript and each
 * state can be linked to. Rows open the Order dialog.
 */
export function AllOrdersDialog({ list, selection }: { list: OrderList; selection: OverviewSelection }) {
  const { query, rows, total, page, pageCount } = list;
  const hrefFor = (overrides: { status?: ItemStatus | null; page?: number }) => {
    const status = overrides.status === undefined ? query.status : overrides.status;
    const extra: Record<string, string> = { orders: "all" };
    if (query.q) extra.q = query.q;
    if (status) extra.status = status;
    if (overrides.page && overrides.page > 1) extra.page = String(overrides.page);
    return overviewHref(selection, extra);
  };
  // The form keeps the range and the status; typing a new search starts again at page 1.
  const hidden = [...new URL(overviewHref(selection, { orders: "all", ...(query.status ? { status: query.status } : {}) }), "http://admin.local").searchParams];

  return (
    <AdminDialog title={`All orders (${total})`} closeHref={overviewHref(selection)} size="lg">
      <div className="fo">
        <form action="/admin" method="get" role="search" className="fo-search">
          {hidden.map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <label htmlFor="fo-q" className="sr-only">
            Search orders
          </label>
          <input id="fo-q" name="q" type="search" className="att-search-input" maxLength={100} defaultValue={query.q} placeholder="Order #, name, email or phone" />
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

        {rows.length === 0 ? (
          <p className="ov-empty">No orders match.</p>
        ) : (
          <div className="att-scroll">
            <table className="ov-table att-table">
              <thead>
                <tr>
                  <th scope="col">Order #</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Items</th>
                  <th scope="col">Service</th>
                  <th scope="col">Status</th>
                  <th scope="col">Deposit</th>
                  <th scope="col" className="ov-num">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.orderId} className="ov-row-link">
                    <td className="ov-ref">
                      <Link href={overviewHref(selection, { order: row.orderId })} scroll={false} aria-label={`Order ${row.reference}, ${row.customerName}`}>
                        {row.reference}
                      </Link>
                    </td>
                    <td>
                      <span className="ov-cell-main">{row.customerName}</span>
                      <span className="ov-cell-sub">{bookedDay.format(row.bookedAt)}</span>
                    </td>
                    <td>{row.pairCount === 1 ? "1 item" : `${row.pairCount} items`}</td>
                    <td>{row.services && <span className="ov-chip-service">{row.services}</span>}</td>
                    <td>
                      <span className="ov-pill" data-tone={STATUS_TONE[row.status]}>
                        {ITEM_STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td>
                      <DepositCell deposit={row.deposit} orderStatus={row.status} />
                    </td>
                    <td className="ov-num ov-total">
                      {row.total.format()}
                      {row.totalIsMinimum ? "+" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
