// The seam (ADR-0003/0011): use-cases depend on this interface, never on
// Prisma directly. See ./prisma-order-repository.ts for the real
// implementation and ./in-memory-order-repository.ts for unit tests.

import type { Money } from "@/shared/money/money";
import type { AuditEntry, Fulfillment, Order } from "../domain";

/**
 * Who the Order belongs to: an existing Customer Account, or a new one the
 * repository creates in the same transaction as the Order. Deciding which
 * (and what to do when an email is taken) is submitOrder's policy, not the
 * repository's (ADR-0014).
 */
export type OrderOwner = { accountId: string } | { newCustomer: { email: string; phone: string } };

/**
 * A new Customer Account's email was taken between submitOrder's lookup and
 * the insert (a concurrent first booking won). Nothing was written; the
 * caller resolves the owner again.
 */
export class EmailTakenError extends Error {
  constructor() {
    super("A Customer Account with this email was just created.");
    this.name = "EmailTakenError";
  }
}

/** A photo key is already attached to an Item (unique item_photos.key). Nothing was written. */
export class PhotoKeyInUseError extends Error {
  constructor() {
    super("A photo is already attached to another booking.");
    this.name = "PhotoKeyInUseError";
  }
}

export interface NewOrderInput {
  owner: OrderOwner;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  policyAcceptedAt: Date;
  fulfillment: Fulfillment;
  rush: boolean;
  estimate: Money;
  estimateIsMinimum: boolean;
  deposit: Money;
  submissionKey: string | null;
  submissionFingerprint: string | null;
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
   * Creates the Order with its Item and photos, and the owner's Account when
   * it's a new customer, all in one transaction. Retry-safe (ADR-0012): if
   * an Order with the same `submissionKey` already exists, returns that
   * Order with `created: false` instead of inserting a duplicate. Throws
   * EmailTakenError or PhotoKeyInUseError, having written nothing.
   */
  create(input: NewOrderInput): Promise<{ order: Order; created: boolean }>;
  findById(orderId: string): Promise<Order | null>;

  /** The Order a submission key already created, if any (ADR-0012 retries). */
  findBySubmissionKey(submissionKey: string): Promise<Order | null>;

  /** Records that the booking confirmation email was sent. */
  markConfirmationEmailSent(orderId: string, sentAt: Date): Promise<void>;

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
