// Test double for the OrderRepository seam — lets use-case unit tests
// (ADR-0012's vertical slice) run with no real Postgres, per the build
// strategy's split between fast unit tests and real-DB integration tests.

import type { AuditEntry, Item, Order } from "../domain";
import type { NewOrderInput, OrderRepository } from "./order-repository";

let nextId = 0;
function fakeId(prefix: string): string {
  nextId += 1;
  return `${prefix}_${nextId}`;
}

export class InMemoryOrderRepository implements OrderRepository {
  readonly orders = new Map<string, Order>();
  readonly appliedIdempotencyKeys = new Set<string>(); // `${itemId}:${key}`

  async create(input: NewOrderInput): Promise<Order> {
    const itemId = fakeId("item");
    const order: Order = {
      id: fakeId("order"),
      accountId: input.accountId,
      guestEmail: input.guestEmail,
      guestPhone: input.guestPhone,
      policyAcceptedAt: input.policyAcceptedAt,
      items: [
        {
          id: itemId,
          orderId: "", // filled in below once order.id exists
          brand: input.item.brand,
          model: input.item.model,
          description: input.item.description,
          status: "REQUEST_SUBMITTED",
          price: null,
          photoKeys: input.item.photoKeys,
        },
      ],
    };
    order.items[0]!.orderId = order.id;
    this.orders.set(order.id, order);
    return order;
  }

  async findById(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) ?? null;
  }

  async transitionItemStatus(params: {
    itemId: string;
    toStatus: Item["status"];
    entry: AuditEntry;
  }): Promise<Item | null> {
    if (params.entry.idempotencyKey) {
      const key = `${params.itemId}:${params.entry.idempotencyKey}`;
      if (this.appliedIdempotencyKeys.has(key)) return null;
      this.appliedIdempotencyKeys.add(key);
    }

    for (const order of this.orders.values()) {
      const item = order.items.find((i) => i.id === params.itemId);
      if (item) {
        item.status = params.toStatus;
        return item;
      }
    }
    return null;
  }
}
