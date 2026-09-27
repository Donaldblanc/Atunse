import { Prisma, type PrismaClient } from "@prisma/client";
import { Money } from "@/shared/money/money";
import type { Order, Item, AuditEntry, Fulfillment, CalendarDate } from "../domain";
import { AccountExistsError, type NewOrderInput, type OrderRepository } from "./order-repository";

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
    items: row.items.map(toDomainItem),
  };
}

/** True for a unique-constraint violation on `field` (Prisma P2002). */
function isUniqueViolation(err: unknown, field: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return false;
  const target = err.meta?.target;
  return Array.isArray(target) ? target.includes(field) : String(target ?? "").includes(field);
}

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: NewOrderInput): Promise<{ order: Order; created: boolean }> {
    if (input.submissionKey) {
      const existing = await this.findBySubmissionKey(input.submissionKey);
      if (existing) return { order: existing, created: false };
    }

    try {
      return { order: await this.insert(input, this.accountLink(input)), created: true };
    } catch (err) {
      // Two concurrent submits with the same key: the loser reads the
      // winner's Order rather than failing.
      if (input.submissionKey && isUniqueViolation(err, "submissionKey")) {
        const existing = await this.findBySubmissionKey(input.submissionKey);
        if (existing) return { order: existing, created: false };
      }
      if (isUniqueViolation(err, "email") && "newCustomer" in input.owner) {
        if (input.owner.ifEmailRegistered === "fail") throw new AccountExistsError();
        // `attach` racing another first booking for the same email: the
        // Account exists now, so connect to it.
        const email = input.owner.newCustomer.email;
        return { order: await this.insert(input, { connect: { email } }), created: true };
      }
      throw err;
    }
  }

  // Nested writes, so a new customer's Account and the Order commit
  // together and the unique email index settles concurrent bookings.
  private accountLink(input: NewOrderInput): Prisma.AccountCreateNestedOneWithoutOrdersInput {
    const { owner } = input;
    if ("accountId" in owner) return { connect: { id: owner.accountId } };
    const create = { role: "CUSTOMER" as const, email: owner.newCustomer.email, phone: owner.newCustomer.phone };
    return owner.ifEmailRegistered === "attach"
      ? { connectOrCreate: { where: { email: owner.newCustomer.email }, create } }
      : { create };
  }

  private async insert(input: NewOrderInput, account: Prisma.AccountCreateNestedOneWithoutOrdersInput): Promise<Order> {
    const { fulfillment } = input;
    const row = await this.prisma.order.create({
      data: {
        account,
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
    return toDomainOrder(row);
  }

  async findBySubmissionKey(submissionKey: string): Promise<Order | null> {
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

  async findByAccountId(accountId: string): Promise<Order[]> {
    const rows = await this.prisma.order.findMany({
      where: { accountId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomainOrder);
  }

  async findPhotoKeysInUse(photoKeys: string[]): Promise<string[]> {
    if (photoKeys.length === 0) return [];
    const rows = await this.prisma.item.findMany({
      where: { photoKeys: { hasSome: photoKeys } },
      select: { photoKeys: true },
    });
    const inUse = new Set(rows.flatMap((row) => row.photoKeys));
    return photoKeys.filter((key) => inUse.has(key));
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
