import { Prisma, type PrismaClient } from "@prisma/client";
import { Money } from "@/shared/money/money";
import { calendarDateFromUtcMidnight, calendarDateToUtcMidnight } from "../calendar-date";
import { MANUAL_PAYMENT_CONFIRMED, type AuditEntry, type CalendarDate, type Fulfillment, type Item, type ItemStatus, type Order, type TermsAcceptance } from "../domain";
import {
  EmailTakenError,
  ItemNotFoundError,
  ItemStatusChangedError,
  PhotoKeyInUseError,
  type NewOrderInput,
  type OrderRepository,
} from "./order-repository";

// Prisma's generated shape never leaks past this file (ADR-0011/0013) —
// every method returns the domain's own Order/Item types.

const ITEM_INCLUDE = { photos: { orderBy: { position: "asc" } } } satisfies Prisma.ItemInclude;
const ORDER_INCLUDE = { items: { include: ITEM_INCLUDE, orderBy: { position: "asc" as const } } } satisfies Prisma.OrderInclude;

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

function toDomainOrder(row: OrderRow): Order {
  return {
    id: row.id,
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
    confirmationEmailSentAt: row.confirmationEmailSentAt,
    submissionFingerprint: row.submissionFingerprint,
    bundleId: row.bundleId,
    items: row.items.map(toDomainItem),
  };
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
      throw err;
    }
  }

  // One nested write: a new customer's Account, the Order, its Item and
  // the Item's photos commit together, and the unique indexes (email per
  // role, photo key) settle races inside that single transaction.
  private async insert(input: NewOrderInput): Promise<Order> {
    const { fulfillment, owner } = input;
    const row = await this.prisma.order.create({
      data: {
        account:
          "accountId" in owner
            ? { connect: { id: owner.accountId } }
            : { create: { role: "CUSTOMER", email: owner.newCustomer.email, phone: owner.newCustomer.phone } },
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
        bundleId: input.bundleId,
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

      return toDomainItem(updated);
    });
  }

  async listBookedBetween(from: Date, to: Date): Promise<Order[]> {
    const rows = await this.prisma.order.findMany({
      where: { createdAt: { gte: from, lt: to } },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDomainOrder);
  }

  async listRecent(limit: number): Promise<Order[]> {
    const rows = await this.prisma.order.findMany({ include: ORDER_INCLUDE, orderBy: { createdAt: "desc" }, take: limit });
    return rows.map(toDomainOrder);
  }

  async listCollectionsOn(date: CalendarDate): Promise<Order[]> {
    const rows = await this.prisma.order.findMany({
      where: { fulfillmentMethod: "PICKUP", pickupDate: calendarDateToUtcMidnight(date) },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDomainOrder);
  }

  async findPaidOrderIds(orderIds: string[]): Promise<Set<string>> {
    const rows = await this.prisma.item.findMany({
      where: { orderId: { in: orderIds }, auditEntries: { some: { action: MANUAL_PAYMENT_CONFIRMED } } },
      select: { orderId: true },
      distinct: ["orderId"],
    });
    return new Set(rows.map((row) => row.orderId));
  }

  async countItemsByStatus(): Promise<Partial<Record<ItemStatus, number>>> {
    const groups = await this.prisma.item.groupBy({ by: ["status"], _count: { _all: true } });
    return Object.fromEntries(groups.map((group) => [group.status, group._count._all]));
  }

  async summarizeAwaitingDeposit(): Promise<{ orders: number; deposits: Money }> {
    const { _count, _sum } = await this.prisma.order.aggregate({
      where: {
        AND: [
          { items: { some: { status: { not: "CANCELLED" } } } },
          { items: { none: { auditEntries: { some: { action: MANUAL_PAYMENT_CONFIRMED } } } } },
        ],
      },
      _count: { _all: true },
      _sum: { depositCents: true },
    });
    return { orders: _count._all, deposits: Money.fromCents(_sum.depositCents ?? 0) };
  }
}
