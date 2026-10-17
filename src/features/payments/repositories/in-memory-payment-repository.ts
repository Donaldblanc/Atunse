// Test double for PaymentRepository: an in-memory store with the Prisma
// one's rules, for use-case tests (ADR-0011).

import type { ItemStatus, PaymentKind, PaymentMethod } from "@/features/orders/domain";
import { PAYMENT_METHOD_LABELS } from "@/features/orders/domain";
import { Money } from "@/shared/money/money";
import {
  OrderNotFoundError,
  orderNumberFromReference,
  PaymentNotFoundError,
  PaymentNotRefundableError,
  refundBlock,
  type PaymentDetail,
  type PaymentRepository,
  type PaymentRow,
  type PaymentSearchFilters,
  type PaymentStats,
  type PaymentStatus,
} from "./payment-repository";

export interface InMemoryOrderSeed {
  id: string;
  number: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  estimateCents: number;
  items: { status?: ItemStatus; brand: string | null; model: string | null; colorway: string | null; serviceIds: string[]; priceCents: number | null; estimateCents: number }[];
}

export interface InMemoryPaymentSeed {
  id: string;
  orderId: string;
  kind: PaymentKind;
  method: PaymentMethod;
  amountCents: number;
  status: PaymentStatus;
  reference: string | null;
  failureReason?: string | null;
  createdAt: Date;
  updatedAt?: Date;
  receivedAt?: Date | null;
  refundedAt?: Date | null;
}

let seq = 0;
const fakeId = (prefix: string) => `${prefix}_${++seq}`;

export class InMemoryPaymentRepository implements PaymentRepository {
  readonly orders = new Map<string, InMemoryOrderSeed>();
  readonly payments: InMemoryPaymentSeed[] = [];
  private readonly auditKeys = new Set<string>(); // `${orderId}:${idempotencyKey}`

  addOrder(order: InMemoryOrderSeed): void {
    this.orders.set(order.id, order);
  }

  addPayment(payment: InMemoryPaymentSeed): void {
    this.payments.push(payment);
  }

  private rowFor(payment: InMemoryPaymentSeed): PaymentRow {
    const order = this.orders.get(payment.orderId)!;
    return {
      id: payment.id,
      orderId: payment.orderId,
      orderNumber: order.number,
      customerName: order.contactName,
      amount: Money.fromCents(payment.amountCents),
      method: payment.method,
      status: payment.status,
      reference: payment.reference,
      createdAt: payment.createdAt,
    };
  }

  async searchPayments(filters: PaymentSearchFilters): Promise<{ rows: PaymentRow[]; total: number }> {
    const needle = filters.q?.trim().toLowerCase() ?? "";
    const number = needle ? orderNumberFromReference(needle) : null;
    const matches = this.payments
      .filter((payment) => {
        const order = this.orders.get(payment.orderId);
        if (!order) return false;
        if (needle) {
          const text = order.contactName.toLowerCase().includes(needle) || (payment.reference ?? "").toLowerCase().includes(needle);
          if (!text && order.number !== number) return false;
        }
        if (filters.method && payment.method !== filters.method) return false;
        if (filters.status && payment.status !== filters.status) return false;
        if (filters.from && payment.createdAt < filters.from) return false;
        if (filters.to && payment.createdAt >= filters.to) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
    const rows = matches.slice(filters.offset, filters.offset + filters.limit).map((payment) => this.rowFor(payment));
    return { rows, total: matches.length };
  }

  async statsFor(range: { start: Date; end: Date }): Promise<PaymentStats> {
    const inRange = this.payments.filter((payment) => payment.createdAt >= range.start && payment.createdAt < range.end);
    // A FAILED Balance stands in for a cancelled one, not a failed charge: leave it out of Failed/Refunded.
    const failedOrRefunded = inRange.filter((p) => p.status === "REFUNDED" || (p.status === "FAILED" && p.kind !== "BALANCE"));
    const sum = (status: PaymentStatus | PaymentStatus[]) => {
      const statuses = Array.isArray(status) ? status : [status];
      const found = inRange.filter((p) => statuses.includes(p.status));
      return { amount: Money.fromCents(found.reduce((total, p) => total + p.amountCents, 0)), count: found.length };
    };
    const paid = sum("RECEIVED");
    return { totalRevenue: paid.amount, paid, pending: sum("PENDING"), failedOrRefunded: { amount: Money.fromCents(failedOrRefunded.reduce((total, p) => total + p.amountCents, 0)), count: failedOrRefunded.length } };
  }

  async getPaymentDetail(paymentId: string): Promise<PaymentDetail | null> {
    const payment = this.payments.find((p) => p.id === paymentId);
    if (!payment) return null;
    const order = this.orders.get(payment.orderId)!;

    const timeline: PaymentDetail["timeline"] = [];
    if (payment.status === "FAILED") {
      timeline.push({ label: "Payment failed", detail: payment.failureReason ?? "The charge didn't go through.", at: payment.updatedAt ?? payment.createdAt });
    } else if (payment.receivedAt) {
      timeline.push({ label: "Payment successful", detail: `Payment processed via ${PAYMENT_METHOD_LABELS[payment.method]}.`, at: payment.receivedAt });
    } else {
      timeline.push({ label: "Payment recorded", detail: `Awaiting payment via ${PAYMENT_METHOD_LABELS[payment.method]}.`, at: payment.createdAt });
    }
    if (payment.status === "REFUNDED" && payment.refundedAt) {
      timeline.push({ label: "Payment refunded", detail: "Marked refunded by the owner.", at: payment.refundedAt });
    }

    return {
      ...this.rowFor(payment),
      kind: payment.kind,
      customerEmail: order.contactEmail,
      customerPhone: order.contactPhone,
      receivedAt: payment.receivedAt ?? null,
      refundedAt: payment.refundedAt ?? null,
      failureReason: payment.failureReason ?? null,
      orderTotal: Money.fromCents(order.estimateCents),
      items: order.items.map((item) => ({
        brand: item.brand ?? "",
        model: item.model ?? "",
        colorway: item.colorway ?? "",
        serviceIds: item.serviceIds,
        price: item.priceCents === null ? null : Money.fromCents(item.priceCents),
        estimate: Money.fromCents(item.estimateCents),
      })),
      timeline,
    };
  }

  async recordPayment(params: {
    orderReference: string;
    amountCents: number;
    method: PaymentMethod;
    reference: string | null;
    actorAccountId: string | null;
    idempotencyKey: string;
  }): Promise<"recorded" | "already-recorded"> {
    const number = orderNumberFromReference(params.orderReference);
    const order = [...this.orders.values()].find((candidate) => (number === null ? candidate.id === params.orderReference : candidate.number === number));
    if (!order) throw new OrderNotFoundError(params.orderReference);

    const key = `${order.id}:${params.idempotencyKey}`;
    if (this.auditKeys.has(key)) return "already-recorded";
    this.auditKeys.add(key);

    this.payments.push({
      id: fakeId("payment"),
      orderId: order.id,
      kind: "FULL",
      method: params.method,
      amountCents: params.amountCents,
      status: "RECEIVED",
      reference: params.reference,
      createdAt: new Date(),
      receivedAt: new Date(),
    });
    return "recorded";
  }

  async refundPayment(params: { paymentId: string; reason: string | null; actorAccountId: string | null; idempotencyKey: string }): Promise<"refunded" | "already-refunded"> {
    const payment = this.payments.find((p) => p.id === params.paymentId);
    if (!payment) throw new PaymentNotFoundError(params.paymentId);

    const key = `${payment.orderId}:${params.idempotencyKey}`;
    if (this.auditKeys.has(key)) return "already-refunded";

    if (payment.status !== "RECEIVED") throw new PaymentNotRefundableError();
    const order = this.orders.get(payment.orderId)!;
    const blocked = refundBlock(payment, order.items.map((item) => item.status ?? "REQUEST_SUBMITTED"));
    if (blocked) throw blocked;
    this.auditKeys.add(key);
    payment.status = "REFUNDED";
    payment.refundedAt = new Date();
    return "refunded";
  }
}
