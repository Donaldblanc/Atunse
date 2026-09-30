// The seam (ADR-0003/0011): use-cases depend on this interface, never on
// Prisma directly. See ./prisma-order-repository.ts for the real
// implementation and ./in-memory-order-repository.ts for unit tests.

import type { Money } from "@/shared/money/money";
import type { AuditEntry, CalendarDate, Fulfillment, ItemStatus, Order, TermsAcceptance } from "../domain";

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

/** No Item has this id. Nothing was written. */
export class ItemNotFoundError extends Error {
  constructor(readonly itemId: string) {
    super("Item not found.");
    this.name = "ItemNotFoundError";
  }
}

/**
 * The Item isn't in the status the transition expected (a stale admin
 * screen, or a concurrent change). Nothing was written.
 */
export class ItemStatusChangedError extends Error {
  constructor(readonly currentStatus: string) {
    super(`The item is now ${currentStatus}; reload and try again.`);
    this.name = "ItemStatusChangedError";
  }
}

/** An upload is already attached to an Item (unique item_photos.uploadKey). Nothing was written. */
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
  /** What was accepted at policyAcceptedAt (ADR-0015). */
  terms: Omit<TermsAcceptance, "acceptedAt">;
  fulfillment: Fulfillment;
  rush: boolean;
  estimate: Money;
  estimateIsMinimum: boolean;
  deposit: Money;
  submissionKey: string | null;
  submissionFingerprint: string | null;
  /** The Bundle bought, or null for a single pair. */
  bundleId: string | null;
  /** One per pair, in the order the customer entered them. */
  items: NewItemInput[];
}

export interface NewItemInput {
  brand: string | null;
  model: string | null;
  description: string | null;
  material: string | null;
  serviceIds: string[];
  estimate: Money;
  /** `key`: the verified copy the Item keeps; `uploadKey`: the upload it came from. */
  photos: { key: string; uploadKey: string }[];
}

export interface OrderRepository {
  /**
   * Creates the Order with its Items and their photos, and the owner's Account when
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
   * in the same transaction, only if the Item is still in
   * `entry.fromStatus`. Returns null if `idempotencyKey` was already
   * recorded for this item (ADR-0012: retry-safe); the caller should treat
   * that as "already applied", not an error. Throws ItemNotFoundError or
   * ItemStatusChangedError, having written nothing.
   */
  transitionItemStatus(params: {
    itemId: string;
    toStatus: Order["items"][number]["status"];
    entry: AuditEntry;
  }): Promise<Order["items"][number] | null>;

  /** Orders booked (created) in [from, to), oldest first. */
  listBookedBetween(from: Date, to: Date): Promise<Order[]>;

  /**
   * The Orders booked in [from, to) that still have a live pair, and what
   * they're worth (liveEstimate in domain.ts), without loading them.
   */
  summarizeBookedBetween(from: Date, to: Date): Promise<{ orders: number; value: Money }>;

  /** The most recently booked Orders, newest first. */
  listRecent(limit: number): Promise<Order[]>;

  /** Local Drop-Off Orders whose collection is booked on `date`, in booking order. */
  listCollectionsOn(date: CalendarDate): Promise<Order[]>;

  /** Which of these Orders have a payment confirmed on any of their Items (MANUAL_PAYMENT_CONFIRMED). */
  findPaidOrderIds(orderIds: string[]): Promise<Set<string>>;

  /** How many Items are in each status right now; statuses with none are left out. */
  countItemsByStatus(): Promise<Partial<Record<ItemStatus, number>>>;

  /**
   * Orders still waiting on their Deposit: no payment confirmed on any of
   * their Items (MANUAL_PAYMENT_CONFIRMED) and at least one Item not
   * cancelled. Returns how many, and their Deposits added up.
   */
  summarizeAwaitingDeposit(): Promise<{ orders: number; deposits: Money }>;
}
