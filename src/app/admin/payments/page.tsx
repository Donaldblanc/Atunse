// The standalone Payments screen: stat cards, a filterable/searchable/paged
// table of every Payment, and a Payment Details side panel for the row
// picked with `?payment=`. Record Payment and Refund Payment are real
// writes (record-payment-action.ts, refund-payment-action.ts).

import { cookies } from "next/headers";
import Link from "next/link";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/features/orders/domain";
import { calendarDateInShopTime } from "@/features/orders/calendar-date";
import { OVERVIEW_PRESET_IDS, OVERVIEW_RANGE_LABELS, DEFAULT_OVERVIEW_RANGE, formatRangeDates, overviewRange, parseOverviewSelection, rangeSearchParams, type OverviewSelection } from "@/features/admin-overview/overview-range";
import { buildPaymentsDeps } from "@/features/payments/deps";
import { getPaymentDetail } from "@/features/payments/use-cases/get-payment-detail";
import { listPayments, parsePaymentsQuery, PAYMENTS_PAGE_SIZE, type PaymentsQuery } from "@/features/payments/use-cases/list-payments";
import { PAYMENT_STATUSES } from "@/features/payments/use-cases/list-payments";
import { PaymentsTable } from "@/features/payments/payments-table";
import { PaymentDetailsPanel } from "@/features/payments/payment-details-panel";
import { RecordPaymentDialog } from "@/features/payments/record-payment-dialog";
import "@/features/payments/payments-screen.css";

export const metadata = { title: "Payments · Atunṣe Admin" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const STATUS_LABELS: Record<string, string> = { PENDING: "Pending", RECEIVED: "Paid", FAILED: "Failed", REFUNDED: "Refunded" };

/** "/admin/payments?..." keeping the current search, filters and range unless an override replaces it. */
function hrefFor(query: PaymentsQuery, selection: OverviewSelection, overrides: { page?: number } = {}): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.method) params.set("method", query.method);
  if (query.status) params.set("status", query.status);
  // A preset or a custom from/to, so paging and closing the panel keep the stretch of days.
  for (const [key, value] of rangeSearchParams(selection)) params.set(key, value);
  if (overrides.page && overrides.page > 1) params.set("page", String(overrides.page));
  const search = params.toString();
  return search ? `/admin/payments?${search}` : "/admin/payments";
}

export default async function AdminPaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actingUser = await actingUserFromCookies(await cookies());
  const query = parsePaymentsQuery(params);

  const now = new Date();
  const range = overviewRange(parseOverviewSelection(params, now), now);

  const deps = buildPaymentsDeps();
  const list = await listPayments(deps, actingUser, query, range);

  const paymentId = typeof params.payment === "string" ? params.payment : null;
  const detail = paymentId ? await getPaymentDetail(deps, actingUser, paymentId) : null;
  const baseHref = hrefFor(query, range.selection, { page: list.page });

  return (
    <div className="ov ov-page pm">
      <div className="ov-header">
        <div>
          <p className="ov-eyebrow">Payments</p>
          <h1 className="ov-title">Payments</h1>
          <p className="pm-subtitle">Track and manage customer payments.</p>
        </div>
        <RecordPaymentDialog />
      </div>

      <div className="pm-stats">
        <StatCard label="Total Revenue" value={list.stats.totalRevenue.amount} change={list.stats.totalRevenue.change} tone="revenue" />
        <StatCard label="Paid Payments" value={list.stats.paid.amount} change={list.stats.paid.change} tone="paid" />
        <StatCard label="Pending Payments" value={list.stats.pending.amount} change={list.stats.pending.change} tone="pending" />
        <StatCard label="Failed/Refunded" value={list.stats.failedOrRefunded.amount} change={list.stats.failedOrRefunded.change} tone="failed" />
      </div>

      <div className="pm-body">
        <div className="pm-main">
          <form action="/admin/payments" method="get" role="search" className="pm-toolbar">
            <label htmlFor="pm-q" className="sr-only">
              Search payments
            </label>
            <input
              id="pm-q"
              name="q"
              type="search"
              className="att-search-input"
              maxLength={100}
              defaultValue={query.q}
              placeholder="Search by order #, customer name, or payment reference…"
            />
            <select name="method" className="pm-select" defaultValue={query.method ?? ""} aria-label="Payment method">
              <option value="">All payment methods</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </select>
            <select name="status" className="pm-select" defaultValue={query.status ?? ""} aria-label="Payment status">
              <option value="">All statuses</option>
              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <select name="range" className="pm-select" defaultValue={range.id === "custom" ? "" : range.id} aria-label="Date range">
              {typeof range.selection === "object" && <option value="">Custom</option>}
              {OVERVIEW_PRESET_IDS.map((id) => (
                <option key={id} value={id}>
                  {OVERVIEW_RANGE_LABELS[id]}
                </option>
              ))}
            </select>
            {typeof range.selection === "object" && (
              <>
                <input type="hidden" name="from" value={range.selection.from} />
                <input type="hidden" name="to" value={range.selection.to} />
              </>
            )}
            <button type="submit" className="admin-btn">
              Search
            </button>
            {(query.q || query.method || query.status || range.id !== DEFAULT_OVERVIEW_RANGE) && (
              <Link className="pm-reset" href="/admin/payments">
                Reset
              </Link>
            )}
          </form>
          <p className="pm-range-dates">{formatRangeDates(range)}</p>

          <PaymentsTable rows={list.rows} buildDetailHref={(id) => `${baseHref}${baseHref.includes("?") ? "&" : "?"}payment=${id}`} selectedId={paymentId} />

          {list.pageCount > 1 && (
            <nav className="fo-pages" aria-label="Pages">
              {list.page > 1 ? (
                <Link className="admin-btn" data-variant="secondary" href={hrefFor(query, range.selection, { page: list.page - 1 })} rel="prev">
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="ov-cell-sub">
                Showing {(list.page - 1) * PAYMENTS_PAGE_SIZE + (list.rows.length > 0 ? 1 : 0)}–{(list.page - 1) * PAYMENTS_PAGE_SIZE + list.rows.length} of {list.total} payments
              </span>
              {list.page < list.pageCount ? (
                <Link className="admin-btn" data-variant="secondary" href={hrefFor(query, range.selection, { page: list.page + 1 })} rel="next">
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>

        {detail && <PaymentDetailsPanel detail={detail} closeHref={baseHref} />}
      </div>
    </div>
  );
}

function StatCard({ label, value, change, tone }: { label: string; value: string; change: { tone: "up" | "down" | "flat"; label: string } | null; tone: string }) {
  return (
    <div className="pm-card" data-tone={tone}>
      <span className="pm-card-icon" aria-hidden="true" />
      <div>
        <p className="pm-card-label">{label}</p>
        <p className="pm-card-value">{value}</p>
        {change && (
          <p className="pm-card-change" data-direction={change.tone}>
            {change.tone === "up" ? "↑" : change.tone === "down" ? "↓" : "→"} {change.label} vs last period
          </p>
        )}
      </div>
    </div>
  );
}
