// Domain types for the orders feature. Framework-agnostic — no Prisma
// import here (ADR-0003/0011: Prisma stays inside repositories).

import { Money } from "@/shared/money/money";
import { RUSH_FEE_CENTS } from "./service-catalog";

export const ITEM_STATUSES = [
  "REQUEST_SUBMITTED",
  "UNDER_REVIEW",
  "QUOTE_SENT",
  "APPROVED",
  "AWAITING_SNEAKERS",
  "IN_PROGRESS",
  "QUALITY_CHECK",
  "READY_FOR_PICKUP_SHIPPING",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

/**
 * CANCELLED is reachable from any state; otherwise the pipeline is linear,
 * with one step back: the owner can return an Item from Under Review to
 * Request Submitted (e.g. a review started by mistake). Nothing has been
 * quoted yet, so nothing else needs undoing.
 */
const FORWARD_TRANSITIONS: Record<ItemStatus, ItemStatus[]> = {
  REQUEST_SUBMITTED: ["UNDER_REVIEW", "CANCELLED"],
  UNDER_REVIEW: ["QUOTE_SENT", "REQUEST_SUBMITTED", "CANCELLED"],
  QUOTE_SENT: ["APPROVED", "CANCELLED"],
  APPROVED: ["AWAITING_SNEAKERS", "CANCELLED"],
  AWAITING_SNEAKERS: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["QUALITY_CHECK", "CANCELLED"],
  QUALITY_CHECK: ["READY_FOR_PICKUP_SHIPPING", "CANCELLED"],
  READY_FOR_PICKUP_SHIPPING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: ItemStatus, to: ItemStatus): boolean {
  return FORWARD_TRANSITIONS[from].includes(to);
}

/** A move to an earlier step (Under Review back to Request Submitted), not progress; Cancelled is neither. */
export function isStepBack(from: ItemStatus, to: ItemStatus): boolean {
  return to !== "CANCELLED" && ITEM_STATUSES.indexOf(to) < ITEM_STATUSES.indexOf(from);
}

/**
 * Where an admin's plain "Update Status" may move a pair: the pipeline's
 * next step and Cancel (canTransition), less the steps that are more than
 * a status change, each with the reason it's held:
 * - Quote Sent and Approved have their own steps. Sending the quote sets
 *   the price and emails the customer (ADR-0001); Approved is the owner
 *   recording the customer's yes. Order detail offers each as its own
 *   control (sendQuote, recordApproval), never as a bare move, so no pair
 *   is Quote Sent without a price or Approved without a recorded yes.
 * - Past Approved while the Order's Deposit is still PENDING: the Order is
 *   held until the owner marks it received (ADR-0002).
 * - Completed while money is outstanding (completionHold): allowed only
 *   once the Balance is RECEIVED, or when nothing is owed beyond the
 *   Deposit (ADR-0002).
 */
/** What completionHold and adminStatusMoves read about an Order. */
export interface CompletionOrder {
  rush: boolean;
  items: { status: ItemStatus; price: Money | null }[];
  payments: PaymentFigures[];
}

/**
 * Why a pair can't be Completed yet, or null when it can: the Order's
 * Balance exists and is RECEIVED, or every live pair is quoted and the
 * quoted total less the Deposit is 0 or less (no Balance is owed).
 * Otherwise money is outstanding: a PENDING Balance, or pairs not all
 * ready yet (the Balance is due once they are).
 */
export function completionHold(order: CompletionOrder): string | null {
  const balance = order.payments.find((payment) => payment.kind === "BALANCE" && payment.status !== "FAILED" && payment.status !== "REFUNDED");
  if (balance) return balance.status === "RECEIVED" ? null : "Balance not collected yet: mark it received in Pending Payments first.";
  const due = balanceDue(order);
  if (due && due.cents <= 0) return null;
  const allReady = livePairs(order).every((item) => item.status === "READY_FOR_PICKUP_SHIPPING" || item.status === "COMPLETED");
  return allReady ? "No Balance recorded yet: create it in this order's Payment section." : "Collected once every pair is ready; the Balance is due then.";
}

export function adminStatusMoves(
  item: { status: ItemStatus },
  order: CompletionOrder,
): { moves: ItemStatus[]; held: string | null } {
  let held: string | null = null;
  const moves = ITEM_STATUSES.filter((next) => {
    if (!canTransition(item.status, next)) return false;
    if (next === "QUOTE_SENT" || next === "APPROVED") return false;
    if (item.status === "APPROVED" && order.payments.some((payment) => payment.kind === "DEPOSIT" && payment.status === "PENDING")) {
      if (next === "CANCELLED") return true;
      held = "Waiting on the deposit: mark it paid in Pending Payments first.";
      return false;
    }
    if (next === "COMPLETED") {
      const reason = completionHold(order);
      if (reason) {
        held = reason;
        return false;
      }
    }
    return true;
  });
  return { moves, held };
}

/** A quote is a sane price for one pair: at least a dollar, and short of a typo like $12000 for $120.00. */
export const MIN_QUOTE_CENTS = 100;
export const MAX_QUOTE_CENTS = 500_000;

/** How admin screens name each status (CONTEXT.md: Status Pipeline). */
export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  REQUEST_SUBMITTED: "Request Submitted",
  UNDER_REVIEW: "Under Review",
  QUOTE_SENT: "Quote Sent",
  APPROVED: "Approved",
  AWAITING_SNEAKERS: "Awaiting Sneakers",
  IN_PROGRESS: "In Progress",
  QUALITY_CHECK: "Quality Check",
  READY_FOR_PICKUP_SHIPPING: "Ready for Drop-Off/Shipping",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/**
 * One status for a whole Order where an admin list needs it (CONTEXT.md:
 * Order Status): its least-advanced pair that isn't cancelled, so an Order
 * only reads "Completed" once every live pair is. Cancelled only when
 * every pair is. Never stored.
 */
export function orderRollupStatus(items: { status: ItemStatus }[]): ItemStatus {
  const live = items.filter((item) => item.status !== "CANCELLED");
  if (live.length === 0) return "CANCELLED";
  return live.reduce((least, item) => (ITEM_STATUSES.indexOf(item.status) < ITEM_STATUSES.indexOf(least) ? item.status : least), live[0]!.status);
}

/**
 * CONTEXT.md: exactly two Fulfillment Methods. PICKUP is the code name for
 * **Local Drop-Off**: DJ collects the pair from the customer's address
 * (NY/NJ/CT) at a booked time and drops it back off when it's done. The
 * code name predates the customer-facing one and is kept so stored Orders
 * and the API stay unchanged; customers never see the word "pickup".
 */
export const FULFILLMENT_METHODS = ["PICKUP", "MAIL_IN"] as const;
export type FulfillmentMethod = (typeof FULFILLMENT_METHODS)[number];

/** What customers see for each Fulfillment Method, everywhere (site and emails). */
export const FULFILLMENT_LABELS: Record<FulfillmentMethod, string> = { PICKUP: "Local Drop-Off", MAIL_IN: "Mail-In" };

export interface Address {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zip: string;
}

import type { CalendarDate } from "./calendar-date";
export type { CalendarDate } from "./calendar-date";

export type Fulfillment =
  | { method: "PICKUP"; address: Address; date: CalendarDate; slot: string }
  | { method: "MAIL_IN"; address: Address; preferredDate: CalendarDate | null };

export interface Item {
  id: string;
  orderId: string;
  brand: string | null;
  model: string | null;
  description: string | null;
  material: string | null;
  /** Entered by the owner on Order detail, e.g. "10"; null until then. */
  size: string | null;
  /** e.g. "Black / White"; null until the owner enters it. */
  colorway: string | null;
  /** The owner's assessment on Order detail, e.g. "Good"; null until entered. */
  condition: string | null;
  serviceIds: string[];
  /** This pair's estimate from the service catalog, before Rush. */
  estimate: Money;
  status: ItemStatus;
  /** The owner's quoted price (Approval Gate); null until quoted. */
  price: Money | null;
  photoKeys: string[];
}

/**
 * ADR-0015: the evidence that a customer affirmatively accepted a specific
 * Terms of Service & Restoration Agreement. Recorded once, at submission.
 */
export interface TermsAcceptance {
  version: string;
  /** The PDF's permanent URL for that version. */
  url: string;
  /** SHA-256 of that PDF's bytes, hex. */
  sha256: string;
  acceptedAt: Date;
  /** Each risk acknowledgment's id (booking-terms.ts) -> whether it was ticked. */
  acknowledgments: Record<string, boolean>;
}

/** CONTEXT.md: Payment. The Deposit is first; the Balance is the rest; FULL covers the whole Order at once. */
export const PAYMENT_KINDS = ["DEPOSIT", "BALANCE", "FULL"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

/** Zelle and Cash are confirmed by hand (ADR-0002); Card and Apple Pay are Stripe, behind its toggle. */
export const PAYMENT_METHODS = ["ZELLE", "CASH", "CARD", "APPLE_PAY"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { ZELLE: "Zelle", CASH: "Cash", CARD: "Card", APPLE_PAY: "Apple Pay" };

export interface Payment {
  id: string;
  kind: PaymentKind;
  method: PaymentMethod;
  amount: Money;
  /** FAILED: a charge that didn't go through; REFUNDED: received, then given back. */
  status: "PENDING" | "RECEIVED" | "FAILED" | "REFUNDED";
  /** Set exactly when status is RECEIVED or REFUNDED. */
  receivedAt: Date | null;
  createdAt: Date;
}

/** CONTEXT.md: Appointment. DJ collecting a Local Drop-Off pair, or dropping it back off. */
export interface Appointment {
  id: string;
  kind: "COLLECTION" | "RETURN";
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  startsAt: Date;
  endsAt: Date;
  /** What the owner wrote for this visit (gate code, "call on arrival"); null when there is none. */
  notes: string | null;
}

export const APPOINTMENT_KIND_LABELS: Record<Appointment["kind"], string> = { COLLECTION: "Collection", RETURN: "Return" };

export interface Order {
  id: string;
  /** Sequential from 1001; shown as orderNumber(number), "ATU-1008". */
  number: number;
  /** Every Order belongs to an Account (ADR-0014); there are no guest orders. */
  accountId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  createdAt: Date;
  /** Bumped by every write to the Order row itself; Edit Order's optimistic check reads it. */
  updatedAt: Date;
  policyAcceptedAt: Date;
  /** Null only for Orders from before the agreement existed. */
  termsAcceptance: TermsAcceptance | null;
  fulfillment: Fulfillment;
  rush: boolean;
  estimate: Money;
  estimateIsMinimum: boolean;
  deposit: Money;
  /** Order detail's totals, set by the owner; zero until then. */
  dropOffFee: Money;
  tax: Money;
  /** The Bundle bought (service-catalog.ts BUNDLE_CATALOG), or null for a single pair. */
  bundleId: string | null;
  confirmationEmailSentAt: Date | null;
  /** What was submitted with its submission key (#76); null for older Orders. */
  submissionFingerprint: string | null;
  items: Item[];
  payments: Payment[];
  appointments: Appointment[];
}

/**
 * An Order's reference everywhere, "ATU-1008": admin screens, the
 * booking confirmation and emails, and the customer's Zelle memo, so a
 * payment can be matched to its Order at a glance.
 */
export function orderNumber(number: number): string {
  return `ATU-${number}`;
}

/** An Order's pairs that aren't cancelled. */
export function livePairs<T extends { status: ItemStatus }>(order: { items: T[] }): T[] {
  return order.items.filter((item) => item.status !== "CANCELLED");
}

/**
 * What an Order is still worth (admin figures): its estimate without its
 * cancelled pairs' share. Order-level charges (Rush) stay while any pair
 * is live; a fully cancelled Order is worth nothing.
 */
export function liveEstimate(order: { estimate: Money; items: { status: ItemStatus; estimate: Money }[] }): Money {
  if (livePairs(order).length === 0) return Money.zero();
  return order.items
    .filter((item) => item.status === "CANCELLED")
    .reduce((sum, item) => sum.subtract(item.estimate), order.estimate);
}

/**
 * The audit action for the owner marking a Zelle/Cash payment received
 * (ADR-0002). Recorded on an Item, it also marks the Order's PENDING
 * Deposit Payment RECEIVED in the same transaction.
 */
export const MANUAL_PAYMENT_CONFIRMED = "MANUAL_PAYMENT_CONFIRMED";

export interface AuditEntry {
  action: string;
  fromStatus: ItemStatus | null;
  toStatus: ItemStatus | null;
  actorAccountId: string | null;
  idempotencyKey: string | null;
  metadata?: Record<string, unknown>;
}

/** How customer-facing copy refers to an Order's sneakers: "your pair" or "your 3 pairs". */
export function pairsPhrase(pairCount: number): string {
  return pairCount === 1 ? "your pair" : `your ${pairCount} pairs`;
}

/**
 * The Order's price once every pair that's still live is quoted, or null
 * while any isn't. Rush is an Order-level charge on top of the pairs. The
 * quote email and the Balance Payment both use this one formula.
 */
export function quotedTotal(order: { rush: boolean; items: { status: ItemStatus; price: Money | null }[] }): Money | null {
  const live = livePairs(order);
  if (live.length === 0 || live.some((item) => item.price === null)) return null;
  const pairs = live.reduce((sum, item) => sum.add(item.price!), Money.zero());
  return order.rush ? pairs.add(Money.fromCents(RUSH_FEE_CENTS)) : pairs;
}

/** The Balance Payment's idempotency key: one per Order (`@@unique([orderId, idempotencyKey])`). */
export function balanceKey(orderId: string): string {
  return `balance:${orderId}`;
}

type PaymentFigures = Pick<Payment, "kind" | "status" | "amount" | "method">;

/** The Deposit that counts against the quoted total: the Order's Deposit unless it failed or was refunded. */
function standingDeposit(order: { payments: PaymentFigures[] }): PaymentFigures | null {
  return order.payments.find((payment) => payment.kind === "DEPOSIT" && payment.status !== "FAILED" && payment.status !== "REFUNDED") ?? null;
}

/** What's still to pay once the whole Order is quoted: the quoted total less the Deposit (CONTEXT.md: Balance). Null while a live pair is unquoted. */
export function balanceDue(order: Parameters<typeof quotedTotal>[0] & { payments: PaymentFigures[] }): Money | null {
  const total = quotedTotal(order);
  return total ? total.subtract(standingDeposit(order)?.amount ?? Money.zero()) : null;
}

/** What the Balance Payment needs after an Order's pairs changed: nothing, a new row, a new amount, or to be dropped. */
export type BalanceChange =
  | { type: "none" }
  | { type: "create"; amount: Money; method: PaymentMethod }
  | { type: "update"; paymentId: string; amount: Money }
  | { type: "cancel"; paymentId: string; reason: string };

/**
 * ADR-0002's Balance rules, applied by the repository inside the
 * transaction of every status change:
 * - Created once every live pair is Ready for Drop-Off/Shipping (or already
 *   Completed), as a PENDING Payment for balanceDue, with the Deposit's
 *   method. Nothing is created when the amount is 0 or less.
 * - While PENDING: follows a cancelled pair's smaller total, and is dropped
 *   (FAILED, with the reason) when the Order is cancelled or nothing is left to pay.
 * - Once received (or dropped) it is left alone.
 */
export function planBalance(order: Parameters<typeof quotedTotal>[0] & { payments: (PaymentFigures & { id: string })[] }): BalanceChange {
  const existing = order.payments.find((payment) => payment.kind === "BALANCE");
  const live = livePairs(order);
  if (existing) {
    if (existing.status !== "PENDING") return { type: "none" };
    if (live.length === 0) return { type: "cancel", paymentId: existing.id, reason: "The order was cancelled." };
    const due = balanceDue(order);
    if (!due) return { type: "none" };
    if (due.cents <= 0) return { type: "cancel", paymentId: existing.id, reason: "Nothing is left to pay." };
    return due.cents === existing.amount.cents ? { type: "none" } : { type: "update", paymentId: existing.id, amount: due };
  }
  if (live.length === 0 || !live.every((item) => item.status === "READY_FOR_PICKUP_SHIPPING" || item.status === "COMPLETED")) return { type: "none" };
  const due = balanceDue(order);
  if (!due || due.cents <= 0) return { type: "none" };
  return { type: "create", amount: due, method: standingDeposit(order)?.method ?? "ZELLE" };
}

/** The audit reasons (metadata.reason on a STATUS_TRANSITION) for pairs the owner moved along by completing a visit. */
export const COLLECTION_COMPLETED = "COLLECTION_COMPLETED";
export const RETURN_COMPLETED = "RETURN_COMPLETED";

export interface VisitMove {
  itemId: string;
  from: ItemStatus;
  to: ItemStatus;
}

export interface VisitStay {
  itemId: string;
  status: ItemStatus;
  reason: string;
}

/** What completing a visit did to the Order's pairs: who moved, and who stayed and why. */
export interface VisitPlan {
  moves: VisitMove[];
  stays: VisitStay[];
}

/**
 * Completing a Collection moves each live pair in Awaiting Sneakers to In
 * Progress; completing a Return moves each pair in Ready for Drop-Off/Shipping
 * to Completed. A move that adminStatusMoves holds (the Deposit, the Balance)
 * stays put, as does a pair that hasn't reached the step the visit moves
 * from. Pairs already past it, or cancelled, are neither.
 */
export function planVisitMoves(
  kind: Appointment["kind"],
  order: CompletionOrder & { items: { id: string }[] },
): VisitPlan {
  const from: ItemStatus = kind === "COLLECTION" ? "AWAITING_SNEAKERS" : "READY_FOR_PICKUP_SHIPPING";
  const to: ItemStatus = kind === "COLLECTION" ? "IN_PROGRESS" : "COMPLETED";
  const plan: VisitPlan = { moves: [], stays: [] };
  for (const item of order.items) {
    if (item.status === "CANCELLED" || ITEM_STATUSES.indexOf(item.status) > ITEM_STATUSES.indexOf(from)) continue;
    if (item.status === from) {
      const { moves, held } = adminStatusMoves(item, order);
      if (moves.includes(to)) plan.moves.push({ itemId: item.id, from, to });
      else plan.stays.push({ itemId: item.id, status: item.status, reason: held ?? "This step is on hold." });
      continue;
    }
    const reason =
      kind === "RETURN"
        ? "Not ready to go back yet."
        : ITEM_STATUSES.indexOf(item.status) < ITEM_STATUSES.indexOf("APPROVED")
          ? "Not approved yet."
          : (adminStatusMoves(item, order).held ?? "Not moved to Awaiting Sneakers yet.");
    plan.stays.push({ itemId: item.id, status: item.status, reason });
  }
  return plan;
}
