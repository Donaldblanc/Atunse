// Test double for the OrderRepository seam — lets use-case unit tests
// (ADR-0012's vertical slice) run with no real Postgres, per the build
// strategy's split between fast unit tests and real-DB integration tests.

import type { AuditEntry, Item, Order } from "../domain";
import { AccountExistsError, type NewOrderInput, type OrderRepository } from "./order-repository";

let nextId = 0;
function fakeId(prefix: string): string {
  nextId += 1;
  return `${prefix}_${nextId}`;
}

export class InMemoryOrderRepository implements OrderRepository {
  readonly orders = new Map<string, Order>();
  readonly appliedIdempotencyKeys = new Set<string>(); // `${itemId}:${key}`
  private readonly orderIdsBySubmissionKey = new Map<string, string>();
  /** email -> accountId; stands in for the accounts table's unique email. */
  readonly accountIdsByEmail = new Map<string, string>();

  async create(input: NewOrderInput): Promise<{ order: Order; created: boolean }> {
    if (input.submissionKey) {
      const existingId = this.orderIdsBySubmissionKey.get(input.submissionKey);
      if (existingId) return { order: this.orders.get(existingId)!, created: false };
    }

    let accountId: string;
    if ("accountId" in input.owner) {
      accountId = input.owner.accountId;
    } else {
      const registered = this.accountIdsByEmail.get(input.owner.newCustomer.email);
      if (registered && input.owner.ifEmailRegistered === "fail") throw new AccountExistsError();
      accountId = registered ?? fakeId("account");
      this.accountIdsByEmail.set(input.owner.newCustomer.email, accountId);
    }

    const orderId = fakeId("order");
    const order: Order = {
      id: orderId,
      accountId,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      createdAt: new Date(),
      policyAcceptedAt: input.policyAcceptedAt,
      fulfillment: input.fulfillment,
      rush: input.rush,
      estimate: input.estimate,
      estimateIsMinimum: input.estimateIsMinimum,
      deposit: input.deposit,
      confirmationEmailSentAt: null,
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

  async findBySubmissionKey(submissionKey: string): Promise<Order | null> {
    const orderId = this.orderIdsBySubmissionKey.get(submissionKey);
    return orderId ? (this.orders.get(orderId) ?? null) : null;
  }

  async findByAccountId(accountId: string): Promise<Order[]> {
    return [...this.orders.values()].filter((order) => order.accountId === accountId).reverse();
  }

  async findPhotoKeysInUse(photoKeys: string[]): Promise<string[]> {
    const inUse = new Set([...this.orders.values()].flatMap((order) => order.items.flatMap((item) => item.photoKeys)));
    return photoKeys.filter((key) => inUse.has(key));
  }

  async markConfirmationEmailSent(orderId: string, sentAt: Date): Promise<void> {
    const order = this.orders.get(orderId);
    if (order) order.confirmationEmailSentAt = sentAt;
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
