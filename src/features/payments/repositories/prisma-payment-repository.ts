import type { Prisma, PrismaClient } from "@prisma/client";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/features/orders/domain";
import { SERVICE_CATALOG } from "@/features/orders/service-catalog";
import { Money } from "@/shared/money/money";
import {
  OrderNotFoundError,
  orderNumberFromReference,
  PAYMENT_RECORDED,
  PAYMENT_REFUNDED,
  PaymentNotFoundError,
  PaymentNotRefundableError,
  type PaymentDetail,
  type PaymentRepository,
  type PaymentRow,
  type PaymentSearchFilters,
  type PaymentStats,
} from "./payment-repository";

/** Prisma's `contains` passes LIKE wildcards through: match a "%" or "_" the owner typed literally. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");

function whereFor(filters: PaymentSearchFilters): Prisma.PaymentWhereInput {
  const clauses: Prisma.PaymentWhereInput[] = [];
  const q = filters.q?.trim();
  if (q) {
    const number = orderNumberFromReference(q);
    clauses.push({
      OR: [
        ...(number === null ? [] : [{ order: { number } }]),
        { order: { contactName: { contains: escapeLike(q), mode: "insensitive" } } },
        { reference: { contains: escapeLike(q), mode: "insensitive" } },
      ],
    });
  }
  if (filters.method) clauses.push({ method: filters.method });
  if (filters.status) clauses.push({ status: filters.status });
  if (filters.from || filters.to) clauses.push({ createdAt: { ...(filters.from && { gte: filters.from }), ...(filters.to && { lt: filters.to }) } });
  return { AND: clauses };
}

const ROW_SELECT = {
  id: true,
  orderId: true,
  amountCents: true,
  method: true,
  status: true,
  reference: true,
  createdAt: true,
  order: { select: { number: true, contactName: true } },
} satisfies Prisma.PaymentSelect;

type RowPayload = Prisma.PaymentGetPayload<{ select: typeof ROW_SELECT }>;

function toRow(row: RowPayload): PaymentRow {
  return {
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.order.number,
    customerName: row.order.contactName,
    amount: Money.fromCents(row.amountCents),
    method: row.method,
    status: row.status,
    reference: row.reference,
    createdAt: row.createdAt,
  };
}

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async searchPayments(filters: PaymentSearchFilters): Promise<{ rows: PaymentRow[]; total: number }> {
    const where = whereFor(filters);
    const [total, found] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        select: ROW_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: filters.offset,
        take: filters.limit,
      }),
    ]);
    return { rows: found.map(toRow), total };
  }

  async statsFor(range: { start: Date; end: Date }): Promise<PaymentStats> {
    const where: Prisma.PaymentWhereInput = { createdAt: { gte: range.start, lt: range.end } };
    const [paid, pending, failedOrRefunded] = await Promise.all([
      this.prisma.payment.aggregate({ where: { ...where, status: "RECEIVED" }, _sum: { amountCents: true }, _count: true }),
      this.prisma.payment.aggregate({ where: { ...where, status: "PENDING" }, _sum: { amountCents: true }, _count: true }),
      this.prisma.payment.aggregate({ where: { ...where, status: { in: ["FAILED", "REFUNDED"] } }, _sum: { amountCents: true }, _count: true }),
    ]);
    return {
      totalRevenue: Money.fromCents(paid._sum.amountCents ?? 0),
      paid: { amount: Money.fromCents(paid._sum.amountCents ?? 0), count: paid._count },
      pending: { amount: Money.fromCents(pending._sum.amountCents ?? 0), count: pending._count },
      failedOrRefunded: { amount: Money.fromCents(failedOrRefunded._sum.amountCents ?? 0), count: failedOrRefunded._count },
    };
  }

  async getPaymentDetail(paymentId: string): Promise<PaymentDetail | null> {
    const row = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          select: {
            number: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
            estimateCents: true,
            items: { select: { brand: true, model: true, colorway: true, serviceIds: true, priceCents: true, estimateCents: true }, orderBy: { position: "asc" } },
          },
        },
      },
    });
    if (!row) return null;

    const timeline: PaymentDetail["timeline"] = [];
    if (row.status === "FAILED") {
      timeline.push({ label: "Payment failed", detail: row.failureReason ?? "The charge didn't go through.", at: row.updatedAt });
    } else if (row.receivedAt) {
      timeline.push({ label: "Payment successful", detail: `Payment processed via ${PAYMENT_METHOD_LABELS[row.method]}.`, at: row.receivedAt });
    } else {
      timeline.push({ label: "Payment recorded", detail: `Awaiting payment via ${PAYMENT_METHOD_LABELS[row.method]}.`, at: row.createdAt });
    }
    if (row.status === "REFUNDED" && row.refundedAt) {
      timeline.push({ label: "Payment refunded", detail: "The amount was given back to the customer.", at: row.refundedAt });
    }

    return {
      id: row.id,
      orderId: row.orderId,
      orderNumber: row.order.number,
      customerName: row.order.contactName,
      customerEmail: row.order.contactEmail,
      customerPhone: row.order.contactPhone,
      amount: Money.fromCents(row.amountCents),
      method: row.method,
      status: row.status,
      reference: row.reference,
      createdAt: row.createdAt,
      kind: row.kind,
      receivedAt: row.receivedAt,
      refundedAt: row.refundedAt,
      failureReason: row.failureReason,
      orderTotal: Money.fromCents(row.order.estimateCents),
      items: row.order.items.map((item) => ({
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
    const order = await this.prisma.order.findFirst({ where: number === null ? { id: params.orderReference } : { number }, select: { id: true } });
    if (!order) throw new OrderNotFoundError(params.orderReference);

    return this.prisma.$transaction(async (tx) => {
      const applied = await tx.orderAuditEntry.findFirst({ where: { orderId: order.id, idempotencyKey: params.idempotencyKey }, select: { id: true } });
      if (applied) return "already-recorded";

      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          kind: "FULL",
          method: params.method,
          amountCents: params.amountCents,
          status: "RECEIVED",
          receivedAt: new Date(),
          confirmedByAccountId: params.actorAccountId,
          reference: params.reference,
        },
      });
      await tx.orderAuditEntry.create({
        data: {
          orderId: order.id,
          action: PAYMENT_RECORDED,
          actorAccountId: params.actorAccountId,
          idempotencyKey: params.idempotencyKey,
          metadata: { paymentId: payment.id, amountCents: params.amountCents, method: params.method, reference: params.reference },
        },
      });
      return "recorded";
    });
  }

  async refundPayment(params: { paymentId: string; reason: string | null; actorAccountId: string | null; idempotencyKey: string }): Promise<"refunded" | "already-refunded"> {
    const payment = await this.prisma.payment.findUnique({ where: { id: params.paymentId }, select: { orderId: true, status: true } });
    if (!payment) throw new PaymentNotFoundError(params.paymentId);

    return this.prisma.$transaction(async (tx) => {
      const applied = await tx.orderAuditEntry.findFirst({ where: { orderId: payment.orderId, idempotencyKey: params.idempotencyKey }, select: { id: true } });
      if (applied) return "already-refunded";

      const { count } = await tx.payment.updateMany({
        where: { id: params.paymentId, status: "RECEIVED" },
        data: { status: "REFUNDED", refundedAt: new Date() },
      });
      // Conditional on the Payment still being RECEIVED: not found above with a fresh idempotency
      // key means it's PENDING, FAILED or already REFUNDED under a different key.
      if (count === 0) throw new PaymentNotRefundableError();

      await tx.orderAuditEntry.create({
        data: {
          orderId: payment.orderId,
          action: PAYMENT_REFUNDED,
          actorAccountId: params.actorAccountId,
          idempotencyKey: params.idempotencyKey,
          metadata: { paymentId: params.paymentId, reason: params.reason },
        },
      });
      return "refunded";
    });
  }
}
