import { Prisma, type PrismaClient } from "@prisma/client";
import { Money } from "@/shared/money/money";
import type { Order, Item, AuditEntry, Fulfillment, CalendarDate } from "../domain";
import type { NewOrderInput, OrderRepository } from "./order-repository";

// Prisma's generated shape never leaks past this file (ADR-0011/0013) —
// every method returns the domain's own Order/Item types.

type ItemRow = Prisma.ItemGetPayload<object>;
type OrderRow = Prisma.OrderGetPayload<{ include: { items: true } }>;

// @db.Date columns come back as UTC midnight; keep them as plain calendar
// dates so a customer's "Oct 3" never becomes "Oct 2" in another timezone.
function toCalendarDate(date: Date): CalendarDate {
  return date.toISOString().slice(0, 10);
}

function fromCalendarDate(date: CalendarDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

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
    photoKeys: row.photoKeys,
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
      date: row.pickupDate ? toCalendarDate(row.pickupDate) : "",
      slot: row.pickupSlot ?? "",
    };
  }
  return { method: "MAIL_IN", address, preferredDate: row.mailInDate ? toCalendarDate(row.mailInDate) : null };
}

function toDomainOrder(row: OrderRow): Order {
  return {
    id: row.id,
    accountId: row.accountId,
    contactName: row.contactName,
    guestEmail: row.guestEmail,
    guestPhone: row.guestPhone,
    policyAcceptedAt: row.policyAcceptedAt,
    fulfillment: toDomainFulfillment(row),
    rush: row.rush,
    estimate: Money.fromCents(row.estimateCents),
    estimateIsMinimum: row.estimateIsMinimum,
    deposit: Money.fromCents(row.depositCents),
    confirmationEmailSentAt: row.confirmationEmailSentAt,
    items: row.items.map(toDomainItem),
  };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: NewOrderInput): Promise<{ order: Order; created: boolean }> {
    if (input.submissionKey) {
      const existing = await this.findBySubmissionKey(input.submissionKey);
      if (existing) return { order: existing, created: false };
    }

    const { fulfillment } = input;
    try {
      const row = await this.prisma.order.create({
        data: {
          accountId: input.accountId,
          contactName: input.contactName,
          guestEmail: input.guestEmail,
          guestPhone: input.guestPhone,
          policyAcceptedAt: input.policyAcceptedAt,
          fulfillmentMethod: fulfillment.method,
          addressLine1: fulfillment.address.line1,
          addressLine2: fulfillment.address.line2,
          city: fulfillment.address.city,
          state: fulfillment.address.state,
          zip: fulfillment.address.zip,
          pickupDate: fulfillment.method === "PICKUP" ? fromCalendarDate(fulfillment.date) : null,
          pickupSlot: fulfillment.method === "PICKUP" ? fulfillment.slot : null,
          mailInDate:
            fulfillment.method === "MAIL_IN" && fulfillment.preferredDate
              ? fromCalendarDate(fulfillment.preferredDate)
              : null,
          rush: input.rush,
          estimateCents: input.estimate.cents,
          estimateIsMinimum: input.estimateIsMinimum,
          depositCents: input.deposit.cents,
          submissionKey: input.submissionKey,
          items: {
            create: [
              {
                brand: input.item.brand,
                model: input.item.model,
                description: input.item.description,
                material: input.item.material,
                serviceIds: input.item.serviceIds,
                estimateCents: input.item.estimate.cents,
                photoKeys: input.item.photoKeys,
                status: "REQUEST_SUBMITTED",
              },
            ],
          },
        },
        include: { items: true },
      });
      return { order: toDomainOrder(row), created: true };
    } catch (err) {
      // Two concurrent submits with the same key: the loser reads the
      // winner's Order rather than failing.
      if (input.submissionKey && isUniqueViolation(err)) {
        const existing = await this.findBySubmissionKey(input.submissionKey);
        if (existing) return { order: existing, created: false };
      }
      throw err;
    }
  }

  private async findBySubmissionKey(submissionKey: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({ where: { submissionKey }, include: { items: true } });
    return row ? toDomainOrder(row) : null;
  }

  async findById(orderId: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
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

      const updated = await tx.item.update({
        where: { id: params.itemId },
        data: { status: params.toStatus },
      });

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
}
