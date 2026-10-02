// The admin "All orders" search (ADR-0003/0011). Its own seam, apart from
// OrderRepository, so it stays a small read-only surface. See
// ./prisma-order-search-repository.ts and ./in-memory-order-search-repository.ts.

import type { Money } from "@/shared/money/money";
import type { ItemStatus, Payment, PaymentMethod } from "../domain";

export interface OrderSearchFilters {
  /** Order number ("ATU-1234" or "1234"), or part of the contact's name, email or phone; null for no text filter. */
  q: string | null;
  /** The Order's derived status (orderRollupStatus), or null for any. */
  status: ItemStatus | null;
  /** Booked in [from, to), instants. */
  from: Date | null;
  to: Date | null;
  /** Orders with a pair taking this Service. */
  serviceId: string | null;
  limit: number;
  offset: number;
}

/** One found Order, with just what the All orders list shows. */
export interface OrderSearchRow {
  orderId: string;
  number: number;
  contactName: string;
  bookedAt: Date;
  estimate: Money;
  estimateIsMinimum: boolean;
  items: { status: ItemStatus; serviceIds: string[]; estimate: Money }[];
  /** The Order's Deposit Payment, or null if it has none. */
  deposit: { method: PaymentMethod; status: Payment["status"] } | null;
}

export interface OrderSearchRepository {
  /** Orders matching every filter, newest booking first, one page of them, plus how many match in all. */
  searchOrders(filters: OrderSearchFilters): Promise<{ rows: OrderSearchRow[]; total: number }>;
}

/** "ATU-1234" or "1234" as an Order number; null when `q` is some other text. */
export function orderNumberFromQuery(q: string): number | null {
  const match = /^(?:ATU-?)?(\d{1,9})$/i.exec(q.trim());
  return match ? Number(match[1]) : null;
}
