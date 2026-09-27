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
  private readonly orderIdsBySubmissionKey = new Map<string, string>();

  async create(input: NewOrderInput): Promise<{ order: Order; created: boolean }> {
    if (input.submissionKey) {
      const existingId = this.orderIdsBySubmissionKey.get(input.submissionKey);
      if (existingId) return { order: this.orders.get(existingId)!, created: false };
    }

    const orderId = fakeId("order");
    const order: Order = {
      id: orderId,
      accountId: input.accountId,
      contactName: input.contactName,
      guestEmail: input.guestEmail,
      guestPhone: input.guestPhone,
      policyAcceptedAt: input.policyAcceptedAt,
      fulfillment: input.fulfillment,
      rush: input.rush,
      estimate: input.estimate,
      estimateIsMinimum: input.estimateIsMinimum,
      deposit: input.deposit,
      items: [
        {
          id: fakeId("item"),
          orderId,
          brand: input.item.brand,
          model: input.item.model,
          description: input.item.description,
          material: input.item.material,
          serviceIds: input.item.serviceIds,
          estimate: input.item.estimate,
          status: "REQUEST_SUBMITTED",
          price: null,
          photoKeys: input.item.photoKeys,
        },
      ],
    };
    this.orders.set(order.id, order);
    if (input.submissionKey) this.orderIdsBySubmissionKey.set(input.submissionKey, order.id);
    return { order, created: true };
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
