import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { FULFILLMENT_LABELS, orderNumber, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/features/orders/domain";
import type { OrderRepository } from "@/features/orders/repositories/order-repository";
import { returnVisitState } from "@/features/orders/return-visit";
import { servicesSummary } from "./get-admin-overview";

// The three lists behind the Overview's Needs Attention items (?attention=…).
// Rows are plain serialisable values (dates already formatted in shop
// time) because Pending Payments hands them to a client component.

export const ATTENTION_PANELS = ["pending-payments", "ready-to-return", "needs-quote"] as const;
export type AttentionPanelId = (typeof ATTENTION_PANELS)[number];

export function parseAttentionPanel(value: string | string[] | undefined): AttentionPanelId | null {
  return ATTENTION_PANELS.find((id) => id === value) ?? null;
}

export type AttentionPanelDeps = { orders: Pick<OrderRepository, "listAwaitingDeposit" | "listWithItemsIn"> };

const bookedDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

export interface PendingPaymentRow {
  orderId: string;
  reference: string;
  customerName: string;
  method: PaymentMethod;
  methodLabel: string;
  /** The Deposit amount, e.g. "$120". */
  amount: string;
  bookedOn: string;
}

/** Orders whose Deposit is PENDING, oldest first: the same set the Overview counts (summarizeAwaitingDeposit). */
export async function getPendingPayments(deps: AttentionPanelDeps, actingUser: ActingUser): Promise<PendingPaymentRow[]> {
  requireRole(actingUser, "ADMIN");
  const awaiting = await deps.orders.listAwaitingDeposit();
  return awaiting.map((row) => ({
    orderId: row.orderId,
    reference: orderNumber(row.number),
    customerName: row.contactName,
    method: row.deposit.method,
    methodLabel: PAYMENT_METHOD_LABELS[row.deposit.method],
    amount: row.deposit.amount.format(),
    bookedOn: bookedDay.format(row.createdAt),
  }));
}

export interface ReadyToReturnRow {
  orderId: string;
  reference: string;
  customerName: string;
  /** How many of the Order's pairs are ready to go back. */
  pairsReady: number;
  fulfillment: string;
  bookedOn: string;
  /** Local Drop-Off only: can DJ's Return be booked now, is it booked (with when), or n/a (Mail-In ships). */
  returnVisit: { kind: "bookable" } | { kind: "booked"; appointmentId: string; when: string } | { kind: "none" };
}

const returnWhen = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

/** Orders with pairs in Ready for Drop-Off/Shipping, oldest first. */
export async function getReadyToReturn(deps: AttentionPanelDeps, actingUser: ActingUser): Promise<ReadyToReturnRow[]> {
  requireRole(actingUser, "ADMIN");
  const orders = await deps.orders.listWithItemsIn(["READY_FOR_PICKUP_SHIPPING"]);
  return orders.map((order) => {
    const state = returnVisitState(order);
    return {
      orderId: order.id,
      reference: orderNumber(order.number),
      customerName: order.contactName,
      pairsReady: order.items.filter((item) => item.status === "READY_FOR_PICKUP_SHIPPING").length,
      fulfillment: FULFILLMENT_LABELS[order.fulfillment.method],
      bookedOn: bookedDay.format(order.createdAt),
      returnVisit:
        state.kind === "bookable"
          ? { kind: "bookable" as const }
          : state.kind === "booked"
            ? { kind: "booked" as const, appointmentId: state.appointment.id, when: returnWhen.format(state.appointment.startsAt) }
            : { kind: "none" as const },
    };
  });
}

export interface NeedsQuoteRow {
  itemId: string;
  orderId: string;
  reference: string;
  customerName: string;
  /** e.g. "Nike Air Max 90", or "Sneakers" when the customer named none. */
  pair: string;
  services: string;
  bookedOn: string;
}

/** Pairs waiting on the owner's review or quote (the Overview's Needs a Quote count), oldest booking first. */
export async function getNeedsQuote(deps: AttentionPanelDeps, actingUser: ActingUser): Promise<NeedsQuoteRow[]> {
  requireRole(actingUser, "ADMIN");
  const orders = await deps.orders.listWithItemsIn(["REQUEST_SUBMITTED", "UNDER_REVIEW"]);
  return orders.flatMap((order) =>
    order.items
      .filter((item) => item.status === "REQUEST_SUBMITTED" || item.status === "UNDER_REVIEW")
      .map((item) => ({
        itemId: item.id,
        orderId: order.id,
        reference: orderNumber(order.number),
        customerName: order.contactName,
        pair: [item.brand, item.model].filter(Boolean).join(" ") || "Sneakers",
        services: servicesSummary([item.serviceIds]),
        bookedOn: bookedDay.format(order.createdAt),
      })),
  );
}
