import type { PrismaClient, Prisma } from "@prisma/client";
import { Money } from "@/shared/money/money";
import type { Order, Item, AuditEntry } from "../domain";
import type { NewOrderInput, OrderRepository } from "./order-repository";

// Prisma's generated shape never leaks past this file (ADR-0011/0013) —
// every method returns the domain's own Order/Item types.

function toDomainItem(row: {
  id: string;
  orderId: string;
  brand: string | null;
  model: string | null;
  description: string | null;
  status: Item["status"];
  priceCents: number | null;
  photoKeys: string[];
}): Item {
  return {
    id: row.id,
    orderId: row.orderId,
    brand: row.brand,
    model: row.model,
    description: row.description,
    status: row.status,
    price: row.priceCents === null ? null : Money.fromCents(row.priceCents),
    photoKeys: row.photoKeys,
  };
}

function toDomainOrder(row: {
  id: string;
  accountId: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  policyAcceptedAt: Date;
  items: Parameters<typeof toDomainItem>[0][];
}): Order {
  return {
    id: row.id,
    accountId: row.accountId,
    guestEmail: row.guestEmail,
    guestPhone: row.guestPhone,
    policyAcceptedAt: row.policyAcceptedAt,
    items: row.items.map(toDomainItem),
  };
}

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: NewOrderInput): Promise<Order> {
    const row = await this.prisma.order.create({
      data: {
        accountId: input.accountId,
        guestEmail: input.guestEmail,
        guestPhone: input.guestPhone,
        policyAcceptedAt: input.policyAcceptedAt,
        items: {
          create: [
            {
              brand: input.item.brand,
              model: input.item.model,
              description: input.item.description,
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

  async findById(orderId: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    return row ? toDomainOrder(row) : null;
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
