// Test double for the OrderRepository seam — lets use-case unit tests
// (ADR-0012's vertical slice) run with no real Postgres, per the build
// strategy's split between fast unit tests and real-DB integration tests.
// New Customer Accounts go into the shared InMemoryAccounts table, the
// same one the sign-in use-cases read, so tests can book → sign in → rebook.

import { InMemoryAccounts, InMemoryEmailTakenError } from "@/features/accounts/repositories/in-memory-repositories";
import type { AuditEntry, Item, Order } from "../domain";
import { EmailTakenError, PhotoKeyInUseError, type NewOrderInput, type OrderRepository } from "./order-repository";

let nextId = 0;
function fakeId(prefix: string): string {
  nextId += 1;
  return `${prefix}_${nextId}`;
}

export class InMemoryOrderRepository implements OrderRepository {
  readonly orders = new Map<string, Order>();
  readonly appliedIdempotencyKeys = new Set<string>(); // `${itemId}:${key}`
  private readonly orderIdsBySubmissionKey = new Map<string, string>();
  private readonly uploadKeysInUse = new Set<string>();

  constructor(readonly accounts: InMemoryAccounts = new InMemoryAccounts()) {}

  async create(input: NewOrderInput): Promise<{ order: Order; created: boolean }> {
    if (input.submissionKey) {
      const existing = await this.findBySubmissionKey(input.submissionKey);
      if (existing) return { order: existing, created: false };
    }

    // Mirror the database's unique indexes, checking before writing
    // anything, like the single Prisma transaction.
    if (input.item.photos.some((photo) => this.uploadKeysInUse.has(photo.uploadKey))) throw new PhotoKeyInUseError();

    let accountId: string;
    if ("accountId" in input.owner) {
      accountId = input.owner.accountId;
    } else {
      try {
        accountId = this.accounts.add({ role: "CUSTOMER", ...input.owner.newCustomer }).id;
      } catch (err) {
        if (err instanceof InMemoryEmailTakenError) throw new EmailTakenError();
        throw err;
      }
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
      submissionFingerprint: input.submissionFingerprint,
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
          photoKeys: input.item.photos.map((photo) => photo.key),
        },
      ],
    };
    for (const photo of input.item.photos) this.uploadKeysInUse.add(photo.uploadKey);
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
