// The admin Payments screen (/admin/payments): the stat cards and the
// table's search, filter, date-range and page. Admin-only (ADR-0012).

import { z } from "zod";
import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { PAYMENT_METHODS, type PaymentMethod } from "@/features/orders/domain";
import { changeBadge } from "@/features/admin-overview/get-admin-overview";
import type { OverviewRange } from "@/features/admin-overview/overview-range";
import { formatDollars } from "../money-format";
import type { PaymentRepository, PaymentRow, PaymentStatus } from "../repositories/payment-repository";

export const PAYMENTS_PAGE_SIZE = 10;
const MAX_QUERY_LENGTH = 100;
const MAX_PAGE = 10_000;
export const PAYMENT_STATUSES: readonly PaymentStatus[] = ["PENDING", "RECEIVED", "FAILED", "REFUNDED"];

export interface PaymentsQuery {
  q: string;
  method: PaymentMethod | null;
  status: PaymentStatus | null;
  page: number;
}

const querySchema = z.string().trim().max(MAX_QUERY_LENGTH);
const methodSchema = z.enum(PAYMENT_METHODS);
const statusSchema = z.enum(PAYMENT_STATUSES as [PaymentStatus, ...PaymentStatus[]]);
const pageSchema = z.coerce.number().int().min(1).max(MAX_PAGE);

const single = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export function parsePaymentsQuery(params: { q?: string | string[]; method?: string | string[]; status?: string | string[]; page?: string | string[] }): PaymentsQuery {
  const q = querySchema.safeParse(single(params.q));
  const method = methodSchema.safeParse(single(params.method));
  const status = statusSchema.safeParse(single(params.status));
  const page = pageSchema.safeParse(single(params.page));
  return {
    q: q.success ? q.data : "",
    method: method.success ? method.data : null,
    status: status.success ? status.data : null,
    page: page.success ? page.data : 1,
  };
}

export interface PaymentsList {
  query: PaymentsQuery;
  rows: PaymentRow[];
  total: number;
  page: number;
  pageCount: number;
  stats: {
    totalRevenue: { amount: string; change: ReturnType<typeof changeBadge> };
    paid: { amount: string; count: number; change: ReturnType<typeof changeBadge> };
    pending: { amount: string; count: number; change: ReturnType<typeof changeBadge> };
    failedOrRefunded: { amount: string; count: number; change: ReturnType<typeof changeBadge> };
  };
}

export async function listPayments(deps: { payments: PaymentRepository }, actingUser: ActingUser, query: PaymentsQuery, range: OverviewRange): Promise<PaymentsList> {
  requireRole(actingUser, "ADMIN");

  const find = (page: number) =>
    deps.payments.searchPayments({
      q: query.q || null,
      method: query.method,
      status: query.status,
      from: range.start,
      to: range.end,
      limit: PAYMENTS_PAGE_SIZE,
      offset: (page - 1) * PAYMENTS_PAGE_SIZE,
    });

  let page = query.page;
  let found = await find(page);
  const pageCount = Math.max(1, Math.ceil(found.total / PAYMENTS_PAGE_SIZE));
  if (page > pageCount) {
    page = pageCount;
    found = await find(page);
  }

  const [current, previous] = await Promise.all([deps.payments.statsFor(range), deps.payments.statsFor(range.previous)]);

  return {
    query,
    rows: found.rows,
    total: found.total,
    page,
    pageCount,
    stats: {
      totalRevenue: { amount: formatDollars(current.totalRevenue), change: changeBadge(current.totalRevenue.cents, previous.totalRevenue.cents) },
      paid: { amount: formatDollars(current.paid.amount), count: current.paid.count, change: changeBadge(current.paid.amount.cents, previous.paid.amount.cents) },
      pending: { amount: formatDollars(current.pending.amount), count: current.pending.count, change: changeBadge(current.pending.amount.cents, previous.pending.amount.cents) },
      failedOrRefunded: {
        amount: formatDollars(current.failedOrRefunded.amount),
        count: current.failedOrRefunded.count,
        change: changeBadge(current.failedOrRefunded.amount.cents, previous.failedOrRefunded.amount.cents),
      },
    },
  };
}
