// The seam (ADR-0003/0011): use-cases depend on this interface, never on
// Prisma directly. See ./prisma-order-repository.ts for the real
// implementation and ./in-memory-order-repository.ts for unit tests.

import type { AuditEntry, Order } from "../domain";

export interface NewOrderInput {
  accountId: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  policyAcceptedAt: Date;
  item: {
    brand: string | null;
    model: string | null;
    description: string | null;
    photoKeys: string[];
  };
}

export interface OrderRepository {
  create(input: NewOrderInput): Promise<Order>;
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
