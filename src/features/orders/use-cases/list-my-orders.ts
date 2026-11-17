import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { FileStorage } from "@/shared/storage";
import { SHOP_TIMEZONE } from "../calendar-date";
import {
  displayStatus,
  FULFILLMENT_LABELS,
  ITEM_STATUS_LABELS,
  orderNumber,
  type Order,
  type Payment,
} from "../domain";
import type { OrderRepository } from "../repositories/order-repository";
import { bundleName, itemRequiresQuote, serviceName, type CatalogSource } from "../service-catalog";

export interface MyOrderPair {
  title: string;
  colorway: string | null;
  size: string | null;
  services: string[];
  /** The customer-facing status label. */
  status: string;
  /** The quoted price, formatted; only once the quote has been sent. */
  quote: string | null;
  /** Short-lived view links; empty when photos aren't available. */
  photoUrls: string[];
}

export interface MyOrderPayment {
  state: "Pending" | "Received";
  amount: string;
}

export interface MyOrder {
  id: string;
  number: string;
  bookedOn: string;
  /** "Local Drop-Off" or "Mail-In". */
  fulfillment: string;
  /** The booked collection day and time for a Local Drop-Off; the preferred day (or null) for Mail-In. */
  when: string | null;
  bundle: string | null;
  pairs: MyOrderPair[];
  estimate: string;
  estimateIsMinimum: boolean;
  deposit: MyOrderPayment | null;
  balance: MyOrderPayment | null;
}

const PHOTOS_PER_PAIR = 3;

const bookedFormat = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: SHOP_TIMEZONE });
const dayFormat = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

function calendarDay(date: string): string {
  return dayFormat.format(new Date(`${date}T00:00:00Z`));
}

function paymentState(order: Order, kind: Payment["kind"]): MyOrderPayment | null {
  const payment = order.payments.find((p) => p.kind === kind && p.status !== "FAILED" && p.status !== "REFUNDED");
  if (!payment) return null;
  return { state: payment.status === "RECEIVED" ? "Received" : "Pending", amount: payment.amount.format() };
}

/**
 * The signed-in Customer's own Orders, newest first, as customer-safe view
 * models (the "My bookings" page). The Account comes from the session, never
 * from the request. No notes, audit entries or admin details leave here.
 * Photos are included only when `storage` is given.
 */
export async function listMyOrders(
  deps: { orders: OrderRepository; catalog: CatalogSource; storage?: FileStorage },
  actingUser: ActingUser,
): Promise<MyOrder[]> {
  requireRole(actingUser, "CUSTOMER");
  if (!actingUser.accountId) return [];

  const [orders, catalog] = await Promise.all([deps.orders.listByAccountId(actingUser.accountId), deps.catalog.load()]);
  const sorted = [...orders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const storage = deps.storage;

  return Promise.all(
    sorted.map(async (order): Promise<MyOrder> => {
      const fulfillment = order.fulfillment;
      return {
        id: order.id,
        number: orderNumber(order.number),
        bookedOn: bookedFormat.format(order.createdAt),
        fulfillment: FULFILLMENT_LABELS[fulfillment.method],
        when:
          fulfillment.method === "PICKUP"
            ? `${calendarDay(fulfillment.date)}, ${fulfillment.slot}`
            : fulfillment.preferredDate
              ? calendarDay(fulfillment.preferredDate)
              : null,
        bundle: order.bundleId ? bundleName(catalog, order.bundleId) : null,
        pairs: await Promise.all(
          order.items.map(async (item): Promise<MyOrderPair> => {
            const status = displayStatus(item.status, itemRequiresQuote(catalog, item.serviceIds));
            const quoted = item.price !== null && status !== "REQUEST_SUBMITTED" && status !== "UNDER_REVIEW";
            return {
              title: [item.brand, item.model].filter(Boolean).join(" ") || "Sneakers",
              colorway: item.colorway,
              size: item.size,
              services: item.serviceIds.map((id) => serviceName(catalog, id)),
              status: ITEM_STATUS_LABELS[status],
              quote: quoted ? item.price!.format() : null,
              photoUrls: storage ? await Promise.all(item.photoKeys.slice(0, PHOTOS_PER_PAIR).map((key) => storage.createViewUrl(key))) : [],
            };
          }),
        ),
        estimate: order.estimate.format(),
        estimateIsMinimum: order.estimateIsMinimum,
        deposit: paymentState(order, "DEPOSIT"),
        balance: paymentState(order, "BALANCE"),
      };
    }),
  );
}
