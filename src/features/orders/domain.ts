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

export interface Item {
  id: string;
  orderId: string;
  brand: string | null;
  model: string | null;
  description: string | null;
  status: ItemStatus;
  price: Money | null;
  photoKeys: string[];
}

export interface Order {
  id: string;
  accountId: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  policyAcceptedAt: Date;
  items: Item[];
}

export interface AuditEntry {
  action: string;
  fromStatus: ItemStatus | null;
  toStatus: ItemStatus | null;
  actorAccountId: string | null;
  idempotencyKey: string | null;
  metadata?: Record<string, unknown>;
}
