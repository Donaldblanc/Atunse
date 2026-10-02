import { Prisma, type PrismaClient } from "@prisma/client";
import { Money } from "@/shared/money/money";
import { calendarDateFromUtcMidnight, calendarDateToUtcMidnight } from "../calendar-date";
import { DETAILS_EDITED, diffOrderDetails, isNoop, ORDER_CONTACT_EDITED, type OrderDetailsInput } from "../order-details";
import { balanceKey, COLLECTION_COMPLETED, completionHold, MANUAL_PAYMENT_CONFIRMED, orderNumber, planBalance, planVisitMoves, RETURN_COMPLETED, type Appointment, type AuditEntry, CalendarDate, Fulfillment, Item, ItemStatus, Order, Payment, PaymentMethod, TermsAcceptance } from "../domain";
import {
  EmailTakenError,
  ItemNotFoundError,
  ItemStatusChangedError,
  NoPendingPaymentError,
  OrderChangedError,
  OrderNotFoundError,
  PhotoKeyInUseError,
  BundleNotFoundError,
  CompletionHeldError,
  AppointmentCancelledError,
  AppointmentMovedError,
  AppointmentNotFoundError,
  AppointmentNotScheduledError,
  ReturnAlreadyBookedError,
  type AdminNotification,
  type AppointmentWithOrder,
  type AwaitingPaymentRow,
  type AwaitingPayments,
  type BookedOrder,
  type CompletedVisit,
  type NewOrderInput,
  type OrderNote,
  type StatusChange,
  type ScheduledAppointment,
  type OrderRepository,
} from "./order-repository";

// Prisma's generated shape never leaks past this file (ADR-0011/0013) —
// every method returns the domain's own Order/Item types.

const ITEM_INCLUDE = { photos: { orderBy: { position: "asc" } } } satisfies Prisma.ItemInclude;
const ORDER_INCLUDE = {
  items: { include: ITEM_INCLUDE, orderBy: { position: "asc" as const } },
  payments: { orderBy: { createdAt: "asc" as const } },
  appointments: { orderBy: { startsAt: "asc" as const } },
} satisfies Prisma.OrderInclude;

/**
 * The Payments Pending Payments is about: a Deposit or Balance, PENDING, on
 * an Order with a live pair. One where-clause behind the summary, the list
 * and confirmPayment, so the count, the rows and what can be confirmed
 * can't drift apart.
 */
const AWAITING_PAYMENT = {
  kind: { in: ["DEPOSIT", "BALANCE"] },
  status: "PENDING",
  order: { items: { some: { status: { not: "CANCELLED" } } } },
} satisfies Prisma.PaymentWhereInput;

type ItemRow = Prisma.ItemGetPayload<{ include: typeof ITEM_INCLUDE }>;
type OrderRow = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

function toDomainItem(row: ItemRow): Item {
  return {
    id: row.id,
    orderId: row.orderId,
    brand: row.brand,
    model: row.model,
    description: row.description,
    material: row.material,
    size: row.size,
    colorway: row.colorway,
    condition: row.condition,
    serviceIds: row.serviceIds,
    estimate: Money.fromCents(row.estimateCents),
    status: row.status,
    price: row.priceCents === null ? null : Money.fromCents(row.priceCents),
    photoKeys: row.photos.map((photo) => photo.key),
  };
}

function toDomainFulfillment(row: OrderRow): Fulfillment {
  const address = {
    line1: row.addressLine1,
    line2: row.addressLine2,
    city: row.city,
    state: row.state,
    zip: row.zip,
  };
  if (row.fulfillmentMethod === "PICKUP") {
    return {
      method: "PICKUP",
      address,
      date: row.pickupDate ? calendarDateFromUtcMidnight(row.pickupDate) : "",
      slot: row.pickupSlot ?? "",
    };
  }
  return { method: "MAIL_IN", address, preferredDate: row.mailInDate ? calendarDateFromUtcMidnight(row.mailInDate) : null };
}

/** Null for Orders from before the agreement existed (ADR-0015). */
function toDomainTermsAcceptance(row: OrderRow): TermsAcceptance | null {
  if (row.termsVersion === null || row.termsUrl === null || row.termsSha256 === null) return null;
  return {
    version: row.termsVersion,
    url: row.termsUrl,
    sha256: row.termsSha256,
    acceptedAt: row.policyAcceptedAt,
    acknowledgments: (row.termsAcknowledgments ?? {}) as Record<string, boolean>,
  };
}

function toDomainPayment(row: OrderRow["payments"][number]): Payment {
  return {
    id: row.id,
    kind: row.kind,
    method: row.method,
    amount: Money.fromCents(row.amountCents),
    status: row.status,
    receivedAt: row.receivedAt,
    createdAt: row.createdAt,
  };
}

function toDomainAppointment(row: OrderRow["appointments"][number]): Appointment {
  return { id: row.id, kind: row.kind, status: row.status, startsAt: row.startsAt, endsAt: row.endsAt, notes: row.notes };
}

function toDomainOrder(row: OrderRow): Order {
  return {
    id: row.id,
    number: row.number,
    accountId: row.accountId,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    policyAcceptedAt: row.policyAcceptedAt,
    termsAcceptance: toDomainTermsAcceptance(row),
    fulfillment: toDomainFulfillment(row),
    rush: row.rush,
    estimate: Money.fromCents(row.estimateCents),
    estimateIsMinimum: row.estimateIsMinimum,
    deposit: Money.fromCents(row.depositCents),
    dropOffFee: Money.fromCents(row.dropOffFeeCents),
    tax: Money.fromCents(row.taxCents),
    confirmationEmailSentAt: row.confirmationEmailSentAt,
    submissionFingerprint: row.submissionFingerprint,
    bundleId: row.bundleId,
    items: row.items.map(toDomainItem),
    payments: row.payments.map(toDomainPayment),
    appointments: row.appointments.map(toDomainAppointment),
  };
}

/**
 * A nested `connect` found no Bundle row (P2025). The Account connect can
 * fail the same way, so the message is checked for the Bundle relation.
 */
function isMissingBundle(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025" && /Bundle/.test(`${String(err.meta?.cause ?? "")} ${err.message}`);
}

/**
 * Takes the Order's row lock for the rest of the transaction. Every write
 * that depends on the Order's pairs and payments (a status change, a
 * completed visit, a confirmed payment) starts here, so concurrent ones
 * run one after another and each reads the other's result.
 */
async function lockOrder(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
}

/** The fields of the unique constraint a Prisma P2002 violated, or null. */
function uniqueViolationFields(err: unknown): string[] | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return null;
  const target = err.meta?.target;
  return Array.isArray(target) ? target.map(String) : [String(target ?? "")];
}

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: NewOrderInput): Promise<{ order: Order; created: boolean }> {
    if (input.submissionKey) {
      const existing = await this.findBySubmissionKey(input.submissionKey);
      if (existing) return { order: existing, created: false };
    }

    try {
      return { order: await this.insert(input), created: true };
    } catch (err) {
      const fields = uniqueViolationFields(err);
      // Two concurrent submits with the same key: the loser reads the
      // winner's Order rather than failing.
      if (input.submissionKey && fields?.includes("submissionKey")) {
        const existing = await this.findBySubmissionKey(input.submissionKey);
        if (existing) return { order: existing, created: false };
      }
      if (fields?.includes("email")) throw new EmailTakenError();
      if (fields?.includes("uploadKey") || fields?.includes("key")) throw new PhotoKeyInUseError();
      if (input.bundleId && isMissingBundle(err)) throw new BundleNotFoundError(input.bundleId);
      throw err;
    }
  }

  // One nested write: a new customer's Account, the Order, its Items and
  // their photos, its Deposit and its collection Appointment commit together, and the unique indexes (email per
  // role, photo key) settle races inside that single transaction.
  private async insert(input: NewOrderInput): Promise<Order> {
    const { fulfillment, owner } = input;
    // One transaction: the Order and its admin alert commit together or not at all.
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.order.create({
        data: {
          account:
            "accountId" in owner
              ? { connect: { id: owner.accountId } }
              : { create: { role: "CUSTOMER" as const, email: owner.newCustomer.email, phone: owner.newCustomer.phone, name: input.contactName } },
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          policyAcceptedAt: input.policyAcceptedAt,
          termsVersion: input.terms.version,
          termsUrl: input.terms.url,
          termsSha256: input.terms.sha256,
          termsAcknowledgments: input.terms.acknowledgments,
          fulfillmentMethod: fulfillment.method,
          addressLine1: fulfillment.address.line1,
          addressLine2: fulfillment.address.line2,
          city: fulfillment.address.city,
          state: fulfillment.address.state,
          zip: fulfillment.address.zip,
          pickupDate: fulfillment.method === "PICKUP" ? calendarDateToUtcMidnight(fulfillment.date) : null,
          pickupSlot: fulfillment.method === "PICKUP" ? fulfillment.slot : null,
          mailInDate:
            fulfillment.method === "MAIL_IN" && fulfillment.preferredDate
              ? calendarDateToUtcMidnight(fulfillment.preferredDate)
              : null,
          rush: input.rush,
          estimateCents: input.estimate.cents,
          estimateIsMinimum: input.estimateIsMinimum,
          depositCents: input.deposit.cents,
          submissionKey: input.submissionKey,
          submissionFingerprint: input.submissionFingerprint,
          bundle: input.bundleId ? { connect: { id: input.bundleId } } : undefined,
          items: {
            create: input.items.map((item, position) => ({
              position,
              brand: item.brand,
              model: item.model,
              description: item.description,
              material: item.material,
              serviceIds: item.serviceIds,
              estimateCents: item.estimate.cents,
              photos: {
                create: item.photos.map((photo, photoPosition) => ({ key: photo.key, uploadKey: photo.uploadKey, position: photoPosition })),
              },
              status: "REQUEST_SUBMITTED" as const,
            })),
          },
          payments: input.depositPayment
            ? { create: { kind: "DEPOSIT" as const, method: input.depositPayment.method, amountCents: input.depositPayment.amount.cents } }
            : undefined,
          appointments: input.collection ? { create: { kind: "COLLECTION" as const, ...input.collection } } : undefined,
        },
        include: ORDER_INCLUDE,
      });
      await tx.notification.create({
        data: { kind: "NEW_BOOKING", recipientAccountId: null, orderId: row.id, title: `New booking ${orderNumber(row.number)}`, body: input.alertBody },
      });
      return toDomainOrder(row);
    });
  }

  async listAdminNotifications(limit: number): Promise<{ notifications: AdminNotification[]; unreadCount: number }> {
    const where = { recipientAccountId: null };
    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return {
      notifications: rows.map((row) => ({ id: row.id, kind: row.kind, title: row.title, body: row.body, orderId: row.orderId, readAt: row.readAt, createdAt: row.createdAt })),
      unreadCount,
    };
  }

  async markAdminNotificationsRead(ids: string[] | "all", at: Date): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { recipientAccountId: null, readAt: null, ...(ids === "all" ? {} : { id: { in: ids } }) },
      data: { readAt: at },
    });
  }

  async findBySubmissionKey(submissionKey: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({ where: { submissionKey }, include: ORDER_INCLUDE });
    return row ? toDomainOrder(row) : null;
  }

  async findById(orderId: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });
    return row ? toDomainOrder(row) : null;
  }

  async markConfirmationEmailSent(orderId: string, sentAt: Date): Promise<void> {
    await this.prisma.order.update({ where: { id: orderId }, data: { confirmationEmailSentAt: sentAt } });
  }

  async transitionItemStatus(params: {
    itemId: string;
    toStatus: Item["status"];
    entry: AuditEntry;
    receivesDeposit?: boolean;
    price?: Money;
    enforceCompletionHold?: boolean;
  }): Promise<Item | null> {
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.item.findUnique({ where: { id: params.itemId }, select: { orderId: true } });
      if (!owner) throw new ItemNotFoundError(params.itemId);
      await lockOrder(tx, owner.orderId);

      // Idempotency (ADR-0012): a repeat call with the same idempotencyKey
      // for this item is a no-op, not a double-transition.
      if (params.entry.idempotencyKey) {
        const existing = await tx.itemAuditEntry.findUnique({
          where: {
            itemId_idempotencyKey: {
              itemId: params.itemId,
              idempotencyKey: params.entry.idempotencyKey,
            },
          },
        });
        if (existing) return null;
      }

      if (params.enforceCompletionHold && params.toStatus === "COMPLETED") {
        const reason = completionHold(toDomainOrder(await tx.order.findUniqueOrThrow({ where: { id: owner.orderId }, include: ORDER_INCLUDE })));
        if (reason) throw new CompletionHeldError(reason);
      }

      // Conditional on the status the caller saw, so a stale or concurrent
      // request can't skip a step in the pipeline.
      const { count } = await tx.item.updateMany({
        where: { id: params.itemId, ...(params.entry.fromStatus ? { status: params.entry.fromStatus } : {}) },
        data: { status: params.toStatus, ...(params.price ? { priceCents: params.price.cents } : {}) },
      });
      if (count === 0) {
        const current = await tx.item.findUnique({ where: { id: params.itemId }, select: { status: true } });
        if (!current) throw new ItemNotFoundError(params.itemId);
        throw new ItemStatusChangedError(current.status);
      }
      const updated = await tx.item.findUniqueOrThrow({ where: { id: params.itemId }, include: ITEM_INCLUDE });

      await tx.itemAuditEntry.create({
        data: {
          itemId: params.itemId,
          action: params.entry.action,
          fromStatus: params.entry.fromStatus,
          toStatus: params.entry.toStatus,
          actorAccountId: params.entry.actorAccountId,
          idempotencyKey: params.entry.idempotencyKey,
          metadata: (params.entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });

      // A confirmed payment settles the Order's PENDING Deposit in the same
      // transaction, so the Payments view and the audit trail never disagree.
      if (params.receivesDeposit) {
        await tx.payment.updateMany({
          where: { orderId: updated.orderId, kind: "DEPOSIT", status: "PENDING" },
          data: {
            status: "RECEIVED",
            receivedAt: new Date(),
            confirmedByAccountId: params.entry.actorAccountId,
            idempotencyKey: params.entry.idempotencyKey,
          },
        });
      }

      await this.settleBalance(tx, updated.orderId);

      return toDomainItem(updated);
    });
  }

  /** Applies planBalance (domain.ts) to the Order as this transaction now sees it. */
  private async settleBalance(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const row = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_INCLUDE });
    const change = planBalance(toDomainOrder(row));
    switch (change.type) {
      case "create":
        // The fixed key makes this idempotent; a concurrent transition that got here first wins quietly.
        await tx.payment.createMany({
          data: [{ orderId, kind: "BALANCE", method: change.method, amountCents: change.amount.cents, idempotencyKey: balanceKey(orderId) }],
          skipDuplicates: true,
        });
        return;
      case "update":
        await tx.payment.updateMany({ where: { id: change.paymentId, status: "PENDING" }, data: { amountCents: change.amount.cents } });
        return;
      case "cancel":
        await tx.payment.updateMany({ where: { id: change.paymentId, status: "PENDING" }, data: { status: "FAILED", failureReason: change.reason } });
        return;
      case "none":
        return;
    }
  }

  async listBookedBetween(from: Date, to: Date): Promise<BookedOrder[]> {
    const rows = await this.prisma.order.findMany({
      where: { createdAt: { gte: from, lt: to } },
      select: {
        id: true,
        createdAt: true,
        estimateCents: true,
        items: { select: { status: true, serviceIds: true, estimateCents: true }, orderBy: { position: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      estimate: Money.fromCents(row.estimateCents),
      items: row.items.map((item) => ({ status: item.status, serviceIds: item.serviceIds, estimate: Money.fromCents(item.estimateCents) })),
    }));
  }

  // liveEstimate (domain.ts) in two aggregates: Orders with a live pair,
  // their estimates summed, minus their cancelled pairs' estimates.
  async summarizeBookedBetween(from: Date, to: Date): Promise<{ orders: number; value: Money }> {
    const liveOrder = { createdAt: { gte: from, lt: to }, items: { some: { status: { not: "CANCELLED" as const } } } };
    const [orders, cancelledPairs] = await Promise.all([
      this.prisma.order.aggregate({ where: liveOrder, _count: { _all: true }, _sum: { estimateCents: true } }),
      this.prisma.item.aggregate({ where: { status: "CANCELLED", order: liveOrder }, _sum: { estimateCents: true } }),
    ]);
    return {
      orders: orders._count._all,
      value: Money.fromCents((orders._sum.estimateCents ?? 0) - (cancelledPairs._sum.estimateCents ?? 0)),
    };
  }

  async listRecent(limit: number): Promise<Order[]> {
    const rows = await this.prisma.order.findMany({ include: ORDER_INCLUDE, orderBy: { createdAt: "desc" }, take: limit });
    return rows.map(toDomainOrder);
  }

  async listAppointmentsBetween(from: Date, to: Date): Promise<ScheduledAppointment[]> {
    const rows = await this.prisma.appointment.findMany({
      where: { status: "SCHEDULED", startsAt: { gte: from, lt: to } },
      include: {
        order: { select: { id: true, number: true, contactName: true, items: { select: { status: true }, orderBy: { position: "asc" } } } },
      },
      orderBy: { startsAt: "asc" },
    });
    return rows.map((row) => ({
      ...toDomainAppointment(row),
      order: { id: row.order.id, number: row.order.number, contactName: row.order.contactName, itemStatuses: row.order.items.map((item) => item.status) },
    }));
  }

  async countItemsByStatus(): Promise<Partial<Record<ItemStatus, number>>> {
    const groups = await this.prisma.item.groupBy({ by: ["status"], _count: { _all: true } });
    return Object.fromEntries(groups.map((group) => [group.status, group._count._all]));
  }

  async summarizeAwaitingPayments(): Promise<AwaitingPayments> {
    const groups = await this.prisma.payment.groupBy({
      by: ["method"],
      where: AWAITING_PAYMENT,
      _count: { _all: true },
      _sum: { amountCents: true },
    });
    const byMethod: Record<PaymentMethod, number> = { ZELLE: 0, CASH: 0, CARD: 0, APPLE_PAY: 0 };
    let cents = 0;
    for (const group of groups) {
      byMethod[group.method] = group._count._all;
      cents += group._sum.amountCents ?? 0;
    }
    return { payments: groups.reduce((sum, g) => sum + g._count._all, 0), amount: Money.fromCents(cents), byMethod };
  }

  async listOrderNotes(orderId: string): Promise<OrderNote[]> {
    const rows = await this.prisma.note.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
    return rows.map((row) => ({ id: row.id, body: row.body, createdAt: row.createdAt }));
  }

  async listStatusChanges(orderId: string): Promise<StatusChange[]> {
    const rows = await this.prisma.itemAuditEntry.findMany({
      where: { item: { orderId }, toStatus: { not: null } },
      orderBy: { createdAt: "asc" },
    });
    // Prisma can't compare two columns in a where, so same-status entries (a confirmed deposit) are dropped here.
    return rows.filter((row) => row.toStatus !== row.fromStatus).map((row) => ({ itemId: row.itemId, toStatus: row.toStatus!, at: row.createdAt }));
  }

  async findAppointment(appointmentId: string): Promise<AppointmentWithOrder | null> {
    const row = await this.prisma.appointment.findUnique({ where: { id: appointmentId }, include: { order: { include: ORDER_INCLUDE } } });
    return row ? { appointment: toDomainAppointment(row), order: toDomainOrder(row.order) } : null;
  }

  async completeAppointment(params: { appointmentId: string; actorAccountId: string | null }): Promise<CompletedVisit> {
    const { appointmentId } = params;
    // The status is part of the WHERE, so a concurrent cancel can't be
    // overwritten. One transaction: the update holds the row's lock until
    // the re-read, so a cancel can't land between them and turn a write we
    // made into AppointmentCancelledError. The errors below only follow a
    // write that matched nothing. Only the call that made the change moves
    // pairs, so a replay finds count 0 and changes nothing.
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.appointment.findUnique({ where: { id: appointmentId }, select: { orderId: true } });
      if (!owner) throw new AppointmentNotFoundError(appointmentId);
      await lockOrder(tx, owner.orderId);
      const { count } = await tx.appointment.updateMany({ where: { id: appointmentId, status: "SCHEDULED" }, data: { status: "COMPLETED" } });
      const row = await tx.appointment.findUnique({ where: { id: appointmentId } });
      if (!row) throw new AppointmentNotFoundError(appointmentId);
      if (count === 0 && row.status === "CANCELLED") throw new AppointmentCancelledError();
      const appointment = toDomainAppointment(row);
      if (count === 0) return { appointment, moves: [], stays: [], alreadyCompleted: true };

      const order = toDomainOrder(await tx.order.findUniqueOrThrow({ where: { id: row.orderId }, include: ORDER_INCLUDE }));
      const plan = planVisitMoves(row.kind, order);
      const reason = row.kind === "COLLECTION" ? COLLECTION_COMPLETED : RETURN_COMPLETED;
      for (const move of plan.moves) {
        // Conditional on the status planned from, like transitionItemStatus.
        const moved = await tx.item.updateMany({ where: { id: move.itemId, status: move.from }, data: { status: move.to } });
        if (moved.count === 0) continue;
        await tx.itemAuditEntry.create({
          data: {
            itemId: move.itemId,
            action: "STATUS_TRANSITION",
            fromStatus: move.from,
            toStatus: move.to,
            actorAccountId: params.actorAccountId,
            idempotencyKey: `visit:${appointmentId}`,
            metadata: { reason },
          },
        });
      }
      return { appointment, ...plan, alreadyCompleted: false };
    });
  }

  async listAwaitingPayments(): Promise<AwaitingPaymentRow[]> {
    const rows = await this.prisma.payment.findMany({
      where: AWAITING_PAYMENT,
      select: { id: true, kind: true, method: true, amountCents: true, order: { select: { id: true, number: true, contactName: true, createdAt: true } } },
      orderBy: { order: { createdAt: "asc" } },
    });
    return rows.map((row) => ({
      paymentId: row.id,
      kind: row.kind as AwaitingPaymentRow["kind"],
      orderId: row.order.id,
      number: row.order.number,
      contactName: row.order.contactName,
      createdAt: row.order.createdAt,
      payment: { method: row.method, amount: Money.fromCents(row.amountCents) },
    }));
  }

  async listWithItemsIn(statuses: ItemStatus[]): Promise<Order[]> {
    const rows = await this.prisma.order.findMany({
      where: { items: { some: { status: { in: statuses } } } },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDomainOrder);
  }

  async confirmPayment(params: { paymentId: string; method: PaymentMethod; actorAccountId: string | null; idempotencyKey: string }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: params.paymentId }, select: { orderId: true, kind: true, idempotencyKey: true } });
      if (!payment) throw new NoPendingPaymentError(params.paymentId);
      await lockOrder(tx, payment.orderId);

      // Idempotency (ADR-0012): the key is recorded on the Order's audit entries, so a retry finds it.
      const applied = await tx.itemAuditEntry.findFirst({
        where: { idempotencyKey: params.idempotencyKey, item: { orderId: payment.orderId } },
        select: { id: true },
      });
      if (applied) return false;

      // Conditional on the Payment still being PENDING, so two admins (or tabs) can't both settle it.
      // A Payment that already has a key (the Balance's fixed one) keeps it; the audit entries carry this one.
      const { count } = await tx.payment.updateMany({
        where: { ...AWAITING_PAYMENT, id: params.paymentId },
        data: {
          status: "RECEIVED",
          receivedAt: new Date(),
          method: params.method,
          confirmedByAccountId: params.actorAccountId,
          ...(payment.idempotencyKey === null ? { idempotencyKey: params.idempotencyKey } : {}),
        },
      });
      if (count === 0) throw new NoPendingPaymentError(params.paymentId);

      const live = await tx.item.findMany({ where: { orderId: payment.orderId, status: { not: "CANCELLED" } }, select: { id: true, status: true } });
      await tx.itemAuditEntry.createMany({
        data: live.map((item) => ({
          itemId: item.id,
          action: MANUAL_PAYMENT_CONFIRMED,
          fromStatus: item.status,
          toStatus: item.status,
          actorAccountId: params.actorAccountId,
          idempotencyKey: params.idempotencyKey,
          metadata: { paymentId: params.paymentId, kind: payment.kind, method: params.method },
        })),
      });
      return true;
    });
  }

  async updateOrderDetails(params: {
    orderId: string;
    expectedUpdatedAt: Date;
    details: OrderDetailsInput;
    actorAccountId: string | null;
    idempotencyKey: string;
  }): Promise<"updated" | "unchanged" | "already-applied"> {
    const { details } = params;
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.order.findUnique({ where: { id: params.orderId }, include: ORDER_INCLUDE });
      if (!row) throw new OrderNotFoundError(params.orderId);

      // Idempotency (ADR-0012): the key is recorded on the entries this writes, so a retry finds it.
      const applied = await tx.itemAuditEntry.findFirst({
        where: { idempotencyKey: { in: [params.idempotencyKey, `${params.idempotencyKey}:contact`] }, item: { orderId: params.orderId } },
        select: { id: true },
      });
      if (applied) return "already-applied";

      if (row.updatedAt.getTime() !== params.expectedUpdatedAt.getTime()) throw new OrderChangedError();
      const order = toDomainOrder(row);
      const itemIds = new Set(order.items.map((item) => item.id));
      const stranger = details.pairs.find((pair) => !itemIds.has(pair.itemId));
      if (stranger) throw new ItemNotFoundError(stranger.itemId);

      const diff = diffOrderDetails(order, details);
      if (isNoop(diff)) return "unchanged";

      // Conditional on updatedAt again: a write that landed between the read above and here (another
      // transaction) makes this match nothing, so two saves can't both win. Writing every field, even
      // when only a pair changed, is what bumps updatedAt for the next editor's check.
      const { count } = await tx.order.updateMany({
        where: { id: params.orderId, updatedAt: params.expectedUpdatedAt },
        data: {
          contactName: details.contact.name,
          contactEmail: details.contact.email,
          contactPhone: details.contact.phone,
          addressLine1: details.address.line1,
          addressLine2: details.address.line2,
          city: details.address.city,
          state: details.address.state,
          zip: details.address.zip,
        },
      });
      if (count === 0) throw new OrderChangedError();

      // Only the pairs that changed, and only their changed fields: an untouched pair keeps its updatedAt.
      for (const change of diff.pairs) {
        const data = Object.fromEntries(Object.entries(change.changes).map(([field, { to }]) => [field, to]));
        await tx.item.update({ where: { id: change.itemId }, data });
        await tx.itemAuditEntry.create({
          data: { itemId: change.itemId, action: DETAILS_EDITED, actorAccountId: params.actorAccountId, idempotencyKey: params.idempotencyKey, metadata: { changes: change.changes } },
        });
      }
      if (diff.contact.length > 0) {
        // No Order-level audit table: the Order's first pair carries it. Field names only, never the customer's details.
        await tx.itemAuditEntry.create({
          data: {
            itemId: row.items[0]!.id,
            action: ORDER_CONTACT_EDITED,
            actorAccountId: params.actorAccountId,
            idempotencyKey: `${params.idempotencyKey}:contact`,
            metadata: { fields: diff.contact },
          },
        });
      }
      return "updated";
    });
  }

  async addOrderNote(params: { orderId: string; authorAccountId: string | null; body: string }): Promise<OrderNote> {
    const order = await this.prisma.order.findUnique({ where: { id: params.orderId }, select: { accountId: true } });
    if (!order) throw new OrderNotFoundError(params.orderId);
    const row = await this.prisma.note.create({
      data: { accountId: order.accountId, orderId: params.orderId, authorAccountId: params.authorAccountId, body: params.body },
    });
    return { id: row.id, body: row.body, createdAt: row.createdAt };
  }

  async findByItemId(itemId: string): Promise<Order | null> {
    const row = await this.prisma.order.findFirst({ where: { items: { some: { id: itemId } } }, include: ORDER_INCLUDE });
    return row ? toDomainOrder(row) : null;
  }

  async rescheduleAppointment(params: { appointmentId: string; expectedStartsAt: Date; startsAt: Date; endsAt: Date }) {
    // Status and the time the caller saw are part of the WHERE, so a concurrent cancel, completion or move can't be overwritten.
    const moved = await this.prisma.appointment.updateMany({
      where: { id: params.appointmentId, status: "SCHEDULED", startsAt: params.expectedStartsAt },
      data: { startsAt: params.startsAt, endsAt: params.endsAt },
    });
    const row = await this.prisma.appointment.findUnique({ where: { id: params.appointmentId } });
    if (!row) throw new AppointmentNotFoundError(params.appointmentId);
    if (moved.count === 1) return { appointment: toDomainAppointment(row), changed: true };
    if (row.status !== "SCHEDULED") throw new AppointmentNotScheduledError(row.status);
    if (row.startsAt.getTime() === params.startsAt.getTime()) return { appointment: toDomainAppointment(row), changed: false };
    throw new AppointmentMovedError();
  }

  async bookReturnAppointment(params: { orderId: string; startsAt: Date; endsAt: Date }) {
    if (!(await this.prisma.order.findUnique({ where: { id: params.orderId }, select: { id: true } }))) throw new OrderNotFoundError(params.orderId);
    // A concurrent booking can insert between the read and the create; the unique index catches it and the loop re-reads.
    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = await this.prisma.appointment.findUnique({ where: { orderId_kind: { orderId: params.orderId, kind: "RETURN" } } });
      if (existing?.status === "CANCELLED") {
        const revived = await this.prisma.appointment.updateMany({
          where: { id: existing.id, status: "CANCELLED" },
          data: { status: "SCHEDULED", startsAt: params.startsAt, endsAt: params.endsAt, notes: null },
        });
        if (revived.count === 1) {
          const row = await this.prisma.appointment.findUniqueOrThrow({ where: { id: existing.id } });
          return { appointment: toDomainAppointment(row), created: true };
        }
        continue;
      }
      if (existing) {
        if (existing.status === "SCHEDULED" && existing.startsAt.getTime() === params.startsAt.getTime()) {
          return { appointment: toDomainAppointment(existing), created: false };
        }
        throw new ReturnAlreadyBookedError();
      }
      try {
        const row = await this.prisma.appointment.create({ data: { orderId: params.orderId, kind: "RETURN", startsAt: params.startsAt, endsAt: params.endsAt } });
        return { appointment: toDomainAppointment(row), created: true };
      } catch (err) {
        if (!uniqueViolationFields(err)) throw err;
      }
    }
    throw new ReturnAlreadyBookedError();
  }
}
