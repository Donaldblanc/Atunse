import { z } from "zod";
import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { addDays, isCalendarDate, shopMidnight, type CalendarDate } from "@/features/orders/calendar-date";
import { SERVICE_CATALOG } from "@/features/orders/service-catalog";
import { ITEM_STATUSES, orderNumber, type ItemStatus } from "@/features/orders/domain";
import type { OrderSearchRepository, OrderSearchRow } from "@/features/orders/repositories/order-search-repository";
import type { Money } from "@/shared/money/money";
import { orderRowFigures } from "./get-admin-overview";

export const ORDERS_PAGE_SIZE = 10;
const MAX_QUERY_LENGTH = 100;
const MAX_PAGE = 10_000;

/** What `?orders=all&q=&status=&page=` asks for, after validation. */
export interface OrdersQuery {
  q: string;
  status: ItemStatus | null;
  page: number;
  /** `?day=`: only Orders booked that New York calendar day. */
  day: CalendarDate | null;
  /** `?service=`: only Orders with this catalog Service (within the Overview range). */
  serviceId: string | null;
}

const querySchema = z.string().trim().max(MAX_QUERY_LENGTH);
const statusSchema = z.enum(ITEM_STATUSES);
const pageSchema = z.coerce.number().int().min(1).max(MAX_PAGE);

const single = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

/** Each param is checked on its own; one that's missing or invalid falls back to its default (no text, any status, page 1, no day, no Service). */
export function parseOrdersQuery(params: {
  q?: string | string[];
  status?: string | string[];
  page?: string | string[];
  day?: string | string[];
  service?: string | string[];
}): OrdersQuery {
  const q = querySchema.safeParse(single(params.q));
  const status = statusSchema.safeParse(single(params.status));
  const page = pageSchema.safeParse(single(params.page));
  const day = single(params.day);
  const service = single(params.service);
  return {
    q: q.success ? q.data : "",
    status: status.success ? status.data : null,
    page: page.success ? page.data : 1,
    day: day !== undefined && isCalendarDate(day) ? day : null,
    serviceId: service !== undefined && SERVICE_CATALOG.some((s) => s.id === service) ? service : null,
  };
}

/** What the repository is asked, checked again here: the use-case doesn't trust its caller either. */
const filtersSchema = z.object({
  q: querySchema,
  limit: z.number().int().min(1).max(50),
  offset: z.number().int().min(0),
});

/** One row of the All orders list. */
export interface OrderListRow {
  orderId: string;
  reference: string;
  customerName: string;
  bookedAt: Date;
  /** Pairs not cancelled (every pair for a fully cancelled Order). */
  pairCount: number;
  services: string;
  /** The derived Order status (orderRollupStatus), the same one Recent Orders shows. */
  status: ItemStatus;
  deposit: OrderSearchRow["deposit"];
  total: Money;
  totalIsMinimum: boolean;
}

export interface OrderList {
  query: OrdersQuery;
  rows: OrderListRow[];
  total: number;
  /** The page shown: the one asked for, or the last when it was past the end. */
  page: number;
  pageCount: number;
}

/** The admin All orders dialog's list: admin-only (ADR-0012), before anything is read. */
export async function searchOrders(
  deps: { orderSearch: OrderSearchRepository },
  actingUser: ActingUser,
  query: OrdersQuery,
  /** The Overview range's [start, end): what a Service filter is counted within. A day filter replaces it. */
  range: { start: Date; end: Date } | null = null,
): Promise<OrderList> {
  requireRole(actingUser, "ADMIN");
  const window = query.day
    ? {
        start: shopMidnight(query.day),
        end: shopMidnight(addDays(query.day, 1)),
      }
    : query.serviceId
      ? range
      : null;

  const find = (page: number) => {
    const filters = filtersSchema.parse({
      q: query.q,
      limit: ORDERS_PAGE_SIZE,
      offset: (page - 1) * ORDERS_PAGE_SIZE,
    });
    return deps.orderSearch.searchOrders({
      q: filters.q || null,
      status: query.status,
      from: window?.start ?? null,
      to: window?.end ?? null,
      serviceId: query.serviceId,
      limit: filters.limit,
      offset: filters.offset,
    });
  };

  let page = query.page;
  let found = await find(page);
  const pageCount = Math.max(1, Math.ceil(found.total / ORDERS_PAGE_SIZE));
  if (page > pageCount) {
    page = pageCount;
    found = await find(page);
  }

  const rows = found.rows.map((order): OrderListRow => ({
    orderId: order.orderId,
    reference: orderNumber(order.number),
    customerName: order.contactName,
    bookedAt: order.bookedAt,
    ...orderRowFigures(order),
    deposit: order.deposit,
  }));
  return { query, rows, total: found.total, page, pageCount };
}
