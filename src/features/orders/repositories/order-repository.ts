// The seam (ADR-0003/0011): use-cases depend on this interface, never on
// Prisma directly. See ./prisma-order-repository.ts for the real
// implementation and ./in-memory-order-repository.ts for unit tests.

import type { Money } from "@/shared/money/money";
import type { AuditEntry, Fulfillment, Order } from "../domain";

export interface NewOrderInput {
  accountId: string | null;
  contactName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  policyAcceptedAt: Date;
  fulfillment: Fulfillment;
  rush: boolean;
  estimate: Money;
  estimateIsMinimum: boolean;
  deposit: Money;
  submissionKey: string | null;
  item: {
    brand: string | null;
    model: string | null;
    description: string | null;
    material: string | null;
    serviceIds: string[];
    estimate: Money;
    photoKeys: string[];
  };
}

export interface OrderRepository {
  /**
   * Creates the Order with its Item. Retry-safe (ADR-0012): if an Order
   * with the same `submissionKey` already exists, returns that Order with
   * `created: false` instead of inserting a duplicate.
   */
  create(input: NewOrderInput): Promise<{ order: Order; created: boolean }>;
  findById(orderId: string): Promise<Order | null>;

  /**
   * Atomically transitions one Item's status and appends its audit entry
   * in the same transaction. Returns null if `idempotencyKey` was already
   * recorded for this item (ADR-0012: retry-safe) — the caller should treat
   * that as "already applied", not an error.
   */
  transitionItemStatus(params: {
    itemId: string;
    toStatus: Order["items"][number]["status"];
    entry: AuditEntry;
  }): Promise<Order["items"][number] | null>;
}
