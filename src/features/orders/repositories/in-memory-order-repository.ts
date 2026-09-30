// Test double for the OrderRepository seam — lets use-case unit tests
// (ADR-0012's vertical slice) run with no real Postgres, per the build
// strategy's split between fast unit tests and real-DB integration tests.
// New Customer Accounts go into the shared InMemoryAccounts table, the
// same one the sign-in use-cases read, so tests can book → sign in → rebook.

import { InMemoryAccounts, InMemoryEmailTakenError } from "@/features/accounts/repositories/in-memory-repositories";
import { Money } from "@/shared/money/money";
import { liveEstimate, livePairs, MANUAL_PAYMENT_CONFIRMED, type AuditEntry, type Item, type ItemStatus, type Order } from "../domain";
import {
  EmailTakenError,
  ItemNotFoundError,
  ItemStatusChangedError,
  PhotoKeyInUseError,
  type NewOrderInput,
  type OrderRepository,
} from "./order-repository";

let nextId = 0;
function fakeId(prefix: string): string {
  nextId += 1;
  return `${prefix}_${nextId}`;
}

export class InMemoryOrderRepository implements OrderRepository {
  readonly orders = new Map<string, Order>();
  readonly appliedIdempotencyKeys = new Set<string>(); // `${itemId}:${key}`
  readonly auditEntries: (AuditEntry & { itemId: string })[] = [];
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
    const uploadKeys = input.items.flatMap((item) => item.photos.map((photo) => photo.uploadKey));
    if (new Set(uploadKeys).size !== uploadKeys.length || uploadKeys.some((key) => this.uploadKeysInUse.has(key))) {
      throw new PhotoKeyInUseError();
    }

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
      termsAcceptance: { ...input.terms, acknowledgments: { ...input.terms.acknowledgments }, acceptedAt: input.policyAcceptedAt },
      fulfillment: input.fulfillment,
      rush: input.rush,
      estimate: input.estimate,
      estimateIsMinimum: input.estimateIsMinimum,
      deposit: input.deposit,
      confirmationEmailSentAt: null,
      submissionFingerprint: input.submissionFingerprint,
      bundleId: input.bundleId,
      items: input.items.map((item) => ({
        id: fakeId("item"),
        orderId,
        brand: item.brand,
        model: item.model,
        description: item.description,
        material: item.material,
        serviceIds: item.serviceIds,
        estimate: item.estimate,
        status: "REQUEST_SUBMITTED",
        price: null,
        photoKeys: item.photos.map((photo) => photo.key),
      })),
    };
    for (const key of uploadKeys) this.uploadKeysInUse.add(key);
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
    const key = params.entry.idempotencyKey ? `${params.itemId}:${params.entry.idempotencyKey}` : null;
    if (key && this.appliedIdempotencyKeys.has(key)) return null;

    const item = [...this.orders.values()].flatMap((o) => o.items).find((i) => i.id === params.itemId);
    if (!item) throw new ItemNotFoundError(params.itemId);
    if (params.entry.fromStatus && item.status !== params.entry.fromStatus) throw new ItemStatusChangedError(item.status);

    item.status = params.toStatus;
    if (key) this.appliedIdempotencyKeys.add(key);
    this.auditEntries.push({ ...params.entry, itemId: params.itemId });
    return item;
  }

  async listBookedBetween(from: Date, to: Date): Promise<Order[]> {
    return [...this.orders.values()]
      .filter((order) => order.createdAt >= from && order.createdAt < to)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async summarizeBookedBetween(from: Date, to: Date): Promise<{ orders: number; value: Money }> {
    const live = (await this.listBookedBetween(from, to)).filter((order) => livePairs(order).length > 0);
    return { orders: live.length, value: live.reduce((sum, order) => sum.add(liveEstimate(order)), Money.zero()) };
  }

  async listRecent(limit: number): Promise<Order[]> {
    return [...this.orders.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  }

  async listCollectionsOn(date: string): Promise<Order[]> {
    return [...this.orders.values()]
      .filter((order) => order.fulfillment.method === "PICKUP" && order.fulfillment.date === date)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async findPaidOrderIds(orderIds: string[]): Promise<Set<string>> {
    const paidItemIds = new Set(this.auditEntries.filter((e) => e.action === MANUAL_PAYMENT_CONFIRMED).map((e) => e.itemId));
    return new Set(
      orderIds.filter((id) => this.orders.get(id)?.items.some((item) => paidItemIds.has(item.id))),
    );
  }

  async countItemsByStatus(): Promise<Partial<Record<ItemStatus, number>>> {
    const counts: Partial<Record<ItemStatus, number>> = {};
    for (const item of [...this.orders.values()].flatMap((order) => order.items)) {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
    }
    return counts;
  }

  async summarizeAwaitingDeposit(): Promise<{ orders: number; deposits: Money }> {
    const paidItemIds = new Set(this.auditEntries.filter((e) => e.action === MANUAL_PAYMENT_CONFIRMED).map((e) => e.itemId));
    const waiting = [...this.orders.values()].filter(
      (order) => order.items.some((item) => item.status !== "CANCELLED") && !order.items.some((item) => paidItemIds.has(item.id)),
    );
    return { orders: waiting.length, deposits: waiting.reduce((sum, order) => sum.add(order.deposit), Money.zero()) };
  }
}
