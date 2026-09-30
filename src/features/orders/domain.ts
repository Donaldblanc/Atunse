// Domain types for the orders feature. Framework-agnostic — no Prisma
// import here (ADR-0003/0011: Prisma stays inside repositories).

import { Money } from "@/shared/money/money";

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

/** CANCELLED is reachable from any state; otherwise the pipeline is linear. */
const FORWARD_TRANSITIONS: Record<ItemStatus, ItemStatus[]> = {
  REQUEST_SUBMITTED: ["UNDER_REVIEW", "CANCELLED"],
  UNDER_REVIEW: ["QUOTE_SENT", "CANCELLED"],
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

export interface Order {
  id: string;
  /** Every Order belongs to an Account (ADR-0014); there are no guest orders. */
  accountId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  createdAt: Date;
  policyAcceptedAt: Date;
  /** Null only for Orders from before the agreement existed. */
  termsAcceptance: TermsAcceptance | null;
  fulfillment: Fulfillment;
  rush: boolean;
  estimate: Money;
  estimateIsMinimum: boolean;
  deposit: Money;
  /** The Bundle bought (service-catalog.ts BUNDLE_CATALOG), or null for a single pair. */
  bundleId: string | null;
  confirmationEmailSentAt: Date | null;
  /** What was submitted with its submission key (#76); null for older Orders. */
  submissionFingerprint: string | null;
  items: Item[];
}

/**
 * Short code the customer quotes in their Zelle memo and emails. The tail
 * of a cuid is its random block, so this is effectively unique at this
 * business's volume, and the owner can always fall back to the full id.
 */
export function orderReference(orderId: string): string {
  return orderId.slice(-8).toUpperCase();
}

/**
 * The audit action recorded when the owner marks a Zelle/Cash payment
 * received (ADR-0002). An Order with none on any of its Items is still
 * waiting on its Deposit, which is always the first payment.
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
