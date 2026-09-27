import { Prisma, type PrismaClient } from "@prisma/client";
import { Money } from "@/shared/money/money";
import { calendarDateFromUtcMidnight, calendarDateToUtcMidnight } from "../calendar-date";
import type { Order, Item, AuditEntry, Fulfillment } from "../domain";
import { EmailTakenError, PhotoKeyInUseError, type NewOrderInput, type OrderRepository } from "./order-repository";

// Prisma's generated shape never leaks past this file (ADR-0011/0013) —
// every method returns the domain's own Order/Item types.

const ITEM_INCLUDE = { photos: { orderBy: { position: "asc" } } } satisfies Prisma.ItemInclude;
const ORDER_INCLUDE = { items: { include: ITEM_INCLUDE } } satisfies Prisma.OrderInclude;

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

function toDomainOrder(row: OrderRow): Order {
  return {
    id: row.id,
    accountId: row.accountId,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    createdAt: row.createdAt,
    policyAcceptedAt: row.policyAcceptedAt,
    fulfillment: toDomainFulfillment(row),
    rush: row.rush,
    estimate: Money.fromCents(row.estimateCents),
    estimateIsMinimum: row.estimateIsMinimum,
    deposit: Money.fromCents(row.depositCents),
    confirmationEmailSentAt: row.confirmationEmailSentAt,
    submissionFingerprint: row.submissionFingerprint,
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
      if (fields?.includes("key")) throw new PhotoKeyInUseError();
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
        items: {
          create: [
            {
              brand: input.item.brand,
              model: input.item.model,
              description: input.item.description,
              material: input.item.material,
              serviceIds: input.item.serviceIds,
              estimateCents: input.item.estimate.cents,
              photos: { create: input.item.photoKeys.map((key, position) => ({ key, position })) },
              status: "REQUEST_SUBMITTED",
            },
          ],
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

      const updated = await tx.item.update({
        where: { id: params.itemId },
        data: { status: params.toStatus },
        include: ITEM_INCLUDE,
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
