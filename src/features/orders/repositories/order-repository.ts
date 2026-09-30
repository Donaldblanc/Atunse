// The seam (ADR-0003/0011): use-cases depend on this interface, never on
// Prisma directly. See ./prisma-order-repository.ts for the real
// implementation and ./in-memory-order-repository.ts for unit tests.

import type { Money } from "@/shared/money/money";
import type { OrderDetailsInput } from "../order-details";
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

/** No Order has this id. Nothing was written. */
export class OrderNotFoundError extends Error {
  constructor(readonly orderId: string) {
    super("Order not found.");
    this.name = "OrderNotFoundError";
  }
}

/** The Order was edited after the admin's form was rendered (a second tab, another admin). Nothing was written. */
export class OrderChangedError extends Error {
  constructor() {
    super("This order changed since you opened it. Reload and try again.");
    this.name = "OrderChangedError";
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

/** One Appointment with the whole Order it belongs to (the Overview's Schedule Item dialog). */
export interface AppointmentWithOrder {
  appointment: Appointment;
  order: Order;
}

/** No Appointment has this id. Nothing was written. */
export class AppointmentNotFoundError extends Error {
  constructor(readonly appointmentId: string) {
    super("Appointment not found.");
    this.name = "AppointmentNotFoundError";
  }
}

/** A cancelled Appointment can't be completed. Nothing was written. */
export class AppointmentCancelledError extends Error {
  constructor() {
    super("This visit was cancelled, so it can't be completed.");
    this.name = "AppointmentCancelledError";
  }
}

/** Nothing to confirm: the Order has no PENDING Deposit on a live pair (already received, or fully cancelled). Nothing was written. */
export class NoPendingDepositError extends Error {
  constructor(readonly orderId: string) {
    super("This order has no deposit waiting to be confirmed.");
    this.name = "NoPendingDepositError";
  }
}

/** One row of Pending Payments: an Order whose Deposit is still PENDING. */
export interface AwaitingDepositOrder {
  orderId: string;
  number: number;
  contactName: string;
  createdAt: Date;
  deposit: { method: PaymentMethod; amount: Money };
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

  /**
   * Every status change recorded on the Order's Items, oldest first. Booking
   * isn't one (an Item starts in its first status), nor is an entry that
   * leaves the status as it was, such as a confirmed deposit.
   */
  listStatusChanges(orderId: string): Promise<StatusChange[]>;

  /** One Appointment (any status) with its Order, or null if no Appointment has this id. */
  findAppointment(appointmentId: string): Promise<AppointmentWithOrder | null>;

  /**
   * Marks an Appointment COMPLETED, only from SCHEDULED. Already COMPLETED
   * is success (a double-click or retry changes nothing), so this is
   * idempotent without a key. It changes the Appointment only: the pairs'
   * statuses move through transitionItemStatus, never as a side effect.
   * Throws AppointmentNotFoundError or AppointmentCancelledError, having
   * written nothing.
   */
  completeAppointment(appointmentId: string): Promise<Appointment>;

  /**
   * The Orders summarizeAwaitingDeposit counts, oldest booking first: one
   * row per PENDING Deposit on an Order with a live pair. Same rule as the
   * summary, so the Pending Payments list and its count always agree.
   */
  listAwaitingDeposit(): Promise<AwaitingDepositOrder[]>;

  /** Orders with at least one Item in one of `statuses`, oldest booking first. */
  listWithItemsIn(statuses: ItemStatus[]): Promise<Order[]>;

  /**
   * Marks the Order's PENDING Deposit Payment RECEIVED (receivedAt now) and
   * appends a MANUAL_PAYMENT_CONFIRMED audit entry to each live Item, without
   * changing any Item's status, all in one transaction (ADR-0002/0012).
   * Returns false, having written nothing, if `idempotencyKey` was already
   * applied to this Order (a retry); the caller treats that as success.
   * Throws NoPendingDepositError when there is no PENDING Deposit to settle
   * (same rule as listAwaitingDeposit), having written nothing.
   */
  confirmDeposit(params: { orderId: string; actorAccountId: string | null; idempotencyKey: string }): Promise<boolean>;

  /**
   * Edit Order: writes the contact, address and pair details in one
   * transaction, only if the Order's updatedAt is still `expectedUpdatedAt`
   * (else OrderChangedError, nothing written). Records what changed
   * (order-details.ts): a DETAILS_EDITED audit entry per changed pair, and
   * one ORDER_CONTACT_EDITED entry on the Order's first pair for contact or
   * address changes (there is no Order-level audit table). Returns
   * "unchanged" when nothing differs (nothing written), "already-applied"
   * when `idempotencyKey` was recorded by an earlier call (a retry).
   * Throws OrderNotFoundError, or ItemNotFoundError for a pair not on the Order.
   */
  updateOrderDetails(params: {
    orderId: string;
    expectedUpdatedAt: Date;
    details: OrderDetailsInput;
    actorAccountId: string | null;
    idempotencyKey: string;
  }): Promise<"updated" | "unchanged" | "already-applied">;

  /**
   * Adds an admin's note to the Order (filed under the Order's customer
   * Account; customers never see Notes). Append-only: nothing edits or
   * removes one yet. Throws OrderNotFoundError.
   */
  addOrderNote(params: { orderId: string; authorAccountId: string | null; body: string }): Promise<OrderNote>;
}
