// The seam (ADR-0003/0011): use-cases depend on this interface, never on
// Prisma directly. See ./prisma-order-repository.ts for the real
// implementation and ./in-memory-order-repository.ts for unit tests.

import type { Money } from "@/shared/money/money";
import type { AuditEntry, Fulfillment, Order } from "../domain";

/**
 * Who the Order belongs to: a signed-in customer's existing Account, or the
 * booking's email. For an email, a Customer Account is created in the same
 * transaction as the Order; if the email is already registered, `fail`
 * throws AccountExistsError (customer login on: they must sign in) and
 * `attach` adds the Order to that Account (login off, ADR-0014).
 */
export type OrderOwner =
  | { accountId: string }
  | { newCustomer: { email: string; phone: string }; ifEmailRegistered: "fail" | "attach" };

/** `create` was asked to make a Customer Account for an email that already has one. */
export class AccountExistsError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "AccountExistsError";
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
   * Creates the Order with its Item, and the owner's Account when it's a new
   * customer, all in one transaction. Retry-safe (ADR-0012): if an Order
   * with the same `submissionKey` already exists, returns that Order with
   * `created: false` instead of inserting a duplicate. Throws
   * AccountExistsError if a new customer's email is already registered.
   */
  create(input: NewOrderInput): Promise<{ order: Order; created: boolean }>;
  findById(orderId: string): Promise<Order | null>;

  /** The Order a submission key already created, if any (ADR-0012 retries). */
  findBySubmissionKey(submissionKey: string): Promise<Order | null>;

  /** A customer's own Orders, newest first. */
  findByAccountId(accountId: string): Promise<Order[]>;

  /** The keys among `photoKeys` already attached to some Item. */
  findPhotoKeysInUse(photoKeys: string[]): Promise<string[]>;

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
