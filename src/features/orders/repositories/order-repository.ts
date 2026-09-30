// The seam (ADR-0003/0011): use-cases depend on this interface, never on
// Prisma directly. See ./prisma-order-repository.ts for the real
// implementation and ./in-memory-order-repository.ts for unit tests.

import type { Money } from "@/shared/money/money";
import type { Appointment, AuditEntry, Fulfillment, Item, ItemStatus, Order, PaymentMethod, TermsAcceptance } from "../domain";

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

/**
 * The Order names a Bundle the bundles table doesn't have (e.g. one taken
 * out of the catalog while the booking page still offered it). Nothing
 * was written.
 */
export class BundleNotFoundError extends Error {
  constructor(readonly bundleId: string) {
    super("That bundle is no longer offered.");
    this.name = "BundleNotFoundError";
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
  /**
   * The Deposit Payment to create PENDING with the Order, or null when
   * none is due. submitOrder decides; repositories just store it.
   */
  depositPayment: { method: PaymentMethod; amount: Money } | null;
  /** Local Drop-Off's COLLECTION Appointment, from its booked slot; null for Mail-In. */
  collection: { startsAt: Date; endsAt: Date } | null;
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

/** An Order as the Overview's range figures read it, without photos, payments or appointments. */
export interface BookedOrder {
  id: string;
  createdAt: Date;
  estimate: Money;
  items: Pick<Item, "status" | "serviceIds" | "estimate">[];
}

/** A Calendar Appointment with what Today's Schedule shows about its Order. */
export interface ScheduledAppointment extends Appointment {
  order: { id: string; number: number; contactName: string; itemStatuses: ItemStatus[] };
}

export interface AwaitingDeposits {
  orders: number;
  deposits: Money;
  byMethod: Record<PaymentMethod, number>;
}

/** An owner's note about an Order (Order detail's Notes). */
export interface OrderNote {
  id: string;
  body: string;
  createdAt: Date;
}

/** When an Item moved to a status, from its audit log (Order detail's timeline). */
export interface StatusChange {
  itemId: string;
  toStatus: ItemStatus;
  at: Date;
}

export interface OrderRepository {
  /**
   * Creates the Order with its Items and their photos, its PENDING Deposit
   * Payment, its COLLECTION Appointment (Local Drop-Off), and the owner's
   * Account when it's a new customer (named after contactName), all in one
   * transaction. Retry-safe (ADR-0012): if
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
   *
   * With `receivesDeposit`, the same transaction also marks the Item's
   * Order's PENDING Deposit Payment RECEIVED (ADR-0002), so a confirmed
   * deposit leaves Pending Payments at once.
   */
  transitionItemStatus(params: {
    itemId: string;
    toStatus: Order["items"][number]["status"];
    entry: AuditEntry;
    receivesDeposit?: boolean;
  }): Promise<Order["items"][number] | null>;

  /** Orders booked (created) in [from, to), oldest first: just what the Overview's figures need. */
  listBookedBetween(from: Date, to: Date): Promise<BookedOrder[]>;

  /**
   * The Orders booked in [from, to) that still have a live pair, and what
   * they're worth (liveEstimate in domain.ts), without loading them.
   */
  summarizeBookedBetween(from: Date, to: Date): Promise<{ orders: number; value: Money }>;

  /** The most recently booked Orders, newest first. */
  listRecent(limit: number): Promise<Order[]>;

  /** SCHEDULED Appointments starting in [from, to), earliest first, with their Order's summary. */
  listAppointmentsBetween(from: Date, to: Date): Promise<ScheduledAppointment[]>;

  /** How many Items are in each status right now; statuses with none are left out. */
  countItemsByStatus(): Promise<Partial<Record<ItemStatus, number>>>;

  /**
   * Deposits still PENDING on Orders with at least one Item not cancelled:
   * how many, their amounts added up, and how many by method.
   */
  summarizeAwaitingDeposit(): Promise<AwaitingDeposits>;

  /** The notes kept about an Order, oldest first. */
  listOrderNotes(orderId: string): Promise<OrderNote[]>;

  /** Every status change recorded on the Order's Items, oldest first. Booking isn't one: an Item starts in its first status. */
  listStatusChanges(orderId: string): Promise<StatusChange[]>;
}
