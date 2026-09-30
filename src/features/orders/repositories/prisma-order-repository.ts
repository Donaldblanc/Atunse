import { Prisma, type PrismaClient } from "@prisma/client";
import { Money } from "@/shared/money/money";
import { calendarDateFromUtcMidnight, calendarDateToUtcMidnight } from "../calendar-date";
import type { Appointment, AuditEntry, CalendarDate, Fulfillment, Item, ItemStatus, Order, Payment, PaymentMethod, TermsAcceptance } from "../domain";
import {
  EmailTakenError,
  ItemNotFoundError,
  ItemStatusChangedError,
  PhotoKeyInUseError,
  BundleNotFoundError,
  AppointmentCancelledError,
  AppointmentNotFoundError,
  type AppointmentWithOrder,
  type AwaitingDeposits,
  type BookedOrder,
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
    const row = await this.prisma.order.create({
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
    return toDomainOrder(row);
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
  }): Promise<Item | null> {
    return this.prisma.$transaction(async (tx) => {
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

      // Conditional on the status the caller saw, so a stale or concurrent
      // request can't skip a step in the pipeline.
      const { count } = await tx.item.updateMany({
        where: { id: params.itemId, ...(params.entry.fromStatus ? { status: params.entry.fromStatus } : {}) },
        data: { status: params.toStatus },
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

      return toDomainItem(updated);
    });
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

  async summarizeAwaitingDeposit(): Promise<AwaitingDeposits> {
    const groups = await this.prisma.payment.groupBy({
      by: ["method"],
      where: { kind: "DEPOSIT", status: "PENDING", order: { items: { some: { status: { not: "CANCELLED" } } } } },
      _count: { _all: true },
      _sum: { amountCents: true },
    });
    const byMethod: Record<PaymentMethod, number> = { ZELLE: 0, CASH: 0, CARD: 0, APPLE_PAY: 0 };
    let cents = 0;
    for (const group of groups) {
      byMethod[group.method] = group._count._all;
      cents += group._sum.amountCents ?? 0;
    }
    // One Deposit per Order, so counting Deposits counts Orders.
    return { orders: groups.reduce((sum, g) => sum + g._count._all, 0), deposits: Money.fromCents(cents), byMethod };
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
    return rows.map((row) => ({ itemId: row.itemId, toStatus: row.toStatus!, at: row.createdAt }));
  }

  async findAppointment(appointmentId: string): Promise<AppointmentWithOrder | null> {
    const row = await this.prisma.appointment.findUnique({ where: { id: appointmentId }, include: { order: { include: ORDER_INCLUDE } } });
    return row ? { appointment: toDomainAppointment(row), order: toDomainOrder(row.order) } : null;
  }

  async completeAppointment(appointmentId: string): Promise<Appointment> {
    // The status is part of the WHERE, so a concurrent cancel can't be overwritten.
    await this.prisma.appointment.updateMany({ where: { id: appointmentId, status: "SCHEDULED" }, data: { status: "COMPLETED" } });
    const row = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!row) throw new AppointmentNotFoundError(appointmentId);
    if (row.status === "CANCELLED") throw new AppointmentCancelledError();
    return toDomainAppointment(row);
  }
}
