// The admin Payments screen's data (ADR-0003/0011): every Payment across
// every Order, searchable and pageable, plus the stat cards and one
// Payment's detail panel. Its own seam, apart from OrderRepository, since
// it reads/writes across Orders rather than one at a time.

import type { PaymentKind, PaymentMethod } from "@/features/orders/domain";
import type { Money } from "@/shared/money/money";

export type PaymentStatus = "PENDING" | "RECEIVED" | "FAILED" | "REFUNDED";

export interface PaymentSearchFilters {
  /** Order number ("ATU-1234" or "1234"), customer name, or payment reference; null for no text filter. */
  q: string | null;
  method: PaymentMethod | null;
  status: PaymentStatus | null;
  /** Created in [from, to), instants; either may be null. */
  from: Date | null;
  to: Date | null;
  limit: number;
  offset: number;
}

/** One row of the Payments table. */
export interface PaymentRow {
  id: string;
  orderId: string;
  orderNumber: number;
  customerName: string;
  amount: Money;
  method: PaymentMethod;
  status: PaymentStatus;
  /** The processor's charge id, a Zelle confirmation number, or null ("Manual"/none noted). */
  reference: string | null;
  createdAt: Date;
}

/** The Payments screen's four stat cards, for one period. */
export interface PaymentStats {
  totalRevenue: Money;
  paid: { amount: Money; count: number };
  pending: { amount: Money; count: number };
  failedOrRefunded: { amount: Money; count: number };
}

export interface PaymentDetailItem {
  brand: string;
  model: string;
  colorway: string;
  serviceIds: string[];
  price: Money | null;
  estimate: Money;
}

export interface PaymentTimelineEntry {
  label: string;
  detail: string;
  at: Date;
}

export interface PaymentDetail extends PaymentRow {
  kind: PaymentKind;
  customerEmail: string;
  customerPhone: string;
  receivedAt: Date | null;
  refundedAt: Date | null;
  failureReason: string | null;
  items: PaymentDetailItem[];
  orderTotal: Money;
  timeline: PaymentTimelineEntry[];
}

export class PaymentNotFoundError extends Error {
  constructor(paymentId: string) {
    super(`Payment ${paymentId} not found`);
    this.name = "PaymentNotFoundError";
  }
}

export class PaymentNotRefundableError extends Error {
  constructor() {
    super("Only a received payment can be refunded.");
    this.name = "PaymentNotRefundableError";
  }
}

export class OrderNotFoundError extends Error {
  constructor(orderReference: string) {
    super(`Order ${orderReference} not found`);
    this.name = "OrderNotFoundError";
  }
}

export interface PaymentRepository {
  /** Payments matching every filter, newest first, one page, plus how many match in all. */
  searchPayments(filters: PaymentSearchFilters): Promise<{ rows: PaymentRow[]; total: number }>;
  /** Totals for the payments created in [range.start, range.end). */
  statsFor(range: { start: Date; end: Date }): Promise<PaymentStats>;
  getPaymentDetail(paymentId: string): Promise<PaymentDetail | null>;
  /**
   * Logs a payment received against an Order outside the Deposit/Balance
   * flow (a cash tip, a manual charge the owner took another way). One
   * transaction: a new RECEIVED Payment (kind FULL) plus an audit entry.
   * Idempotent on `idempotencyKey` (ADR-0012): a retry returns
   * "already-recorded" and writes nothing. Throws OrderNotFoundError when
   * `orderReference` ("ATU-1234" or "1234") doesn't match an Order.
   */
  recordPayment(params: {
    orderReference: string;
    amountCents: number;
    method: PaymentMethod;
    reference: string | null;
    actorAccountId: string | null;
    idempotencyKey: string;
  }): Promise<"recorded" | "already-recorded">;
  /**
   * Refunds a received Payment: sets it REFUNDED plus an audit entry, in
   * one transaction. Idempotent on `idempotencyKey`. Throws
   * PaymentNotFoundError or PaymentNotRefundableError (already refunded,
   * or never received).
   */
  refundPayment(params: {
    paymentId: string;
    reason: string | null;
    actorAccountId: string | null;
    idempotencyKey: string;
  }): Promise<"refunded" | "already-refunded">;
}

export const PAYMENT_RECORDED = "PAYMENT_RECORDED";
export const PAYMENT_REFUNDED = "PAYMENT_REFUNDED";

/** "ATU-1234" or "1234" as an Order number; null when it doesn't read like one. */
export function orderNumberFromReference(value: string): number | null {
  const match = /^(?:ATU-?)?(\d{1,9})$/i.exec(value.trim());
  return match ? Number(match[1]) : null;
}
