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

/** CONTEXT.md: exactly two Fulfillment Methods. There is no drop-off. */
export const FULFILLMENT_METHODS = ["PICKUP", "MAIL_IN"] as const;
export type FulfillmentMethod = (typeof FULFILLMENT_METHODS)[number];

export interface Address {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zip: string;
}

/** Calendar dates travel as "YYYY-MM-DD" so no timezone can shift them. */
export type CalendarDate = string;

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

export interface Order {
  id: string;
  /** Every Order belongs to an Account (ADR-0014); there are no guest orders. */
  accountId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  createdAt: Date;
  policyAcceptedAt: Date;
  fulfillment: Fulfillment;
  rush: boolean;
  estimate: Money;
  estimateIsMinimum: boolean;
  deposit: Money;
  confirmationEmailSentAt: Date | null;
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

export interface AuditEntry {
  action: string;
  fromStatus: ItemStatus | null;
  toStatus: ItemStatus | null;
  actorAccountId: string | null;
  idempotencyKey: string | null;
  metadata?: Record<string, unknown>;
}
