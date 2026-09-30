import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { CalendarDate } from "@/features/orders/calendar-date";
import {
  adminStatusMoves,
  canTransition,
  FULFILLMENT_LABELS,
  ITEM_STATUSES,
  liveEstimate,
  livePairs,
  orderNumber,
  orderRollupStatus,
  type Item,
  type ItemStatus,
  type Order,
  type Payment,
} from "@/features/orders/domain";
import type { OrderNote, OrderRepository, StatusChange } from "@/features/orders/repositories/order-repository";
import { BUNDLE_CATALOG, RUSH_FEE_CENTS, SERVICE_CATALOG } from "@/features/orders/service-catalog";
import { Money } from "@/shared/money/money";
import { quotedTotal } from "@/features/orders/status-emails";
import { pairPhoto, type PairPhoto } from "./pair-photo";

// The Overview's Order detail dialog (design: View Recent Order Details).
// Lives beside the Overview because Recent Orders, Today's Schedule and
// Pending Payments all open it with `?order=<id>`; when the Orders screen
// exists it can move to its own feature folder (ADR-0011).

export interface OrderDetailDeps {
  orders: Pick<OrderRepository, "findById" | "listOrderNotes" | "listStatusChanges">;
  /** A short-lived view link for a stored photo (ADR-0014), or null when photos can't be shown. */
  photoUrl: (key: string) => Promise<string | null>;
}

export interface OrderDetailPair {
  itemId: string;
  /** The pair's first photo. */
  photo: PairPhoto;
  /** e.g. "Nike Air Max 90"; null when the customer gave neither. */
  title: string | null;
  /** What's known beyond that: material, size, colorway, the customer's description. */
  details: string[];
  /** This pair's estimate, before Rush. */
  estimate: Money;
  /** The owner's quote (Item.price); null until sent. */
  price: Money | null;
  status: ItemStatus;
  /** The Services booked; a price is left off inside a Bundle, whose fixed price covers them. */
  services: { name: string; price: string | null }[];
  /** Where Update Status can take this pair (adminStatusMoves in domain.ts). */
  nextStatuses: ItemStatus[];
  /** Why the next step isn't offered yet (awaiting the quote or the deposit), or null. */
  held: string | null;
}

export interface TimelineStep {
  status: ItemStatus;
  state: "done" | "current" | "upcoming";
  /** When the step was reached, when the audit log knows; null rather than guessed. */
  at: Date | null;
}

export interface OrderDetail {
  orderId: string;
  reference: string;
  bookedAt: Date;
  /** The Order's one status (orderRollupStatus). */
  status: ItemStatus;
  customer: {
    name: string;
    email: string;
    phone: string;
    fulfillment: string;
    /** The booked collection (Local Drop-Off) or the preferred ship date (Mail-In); null if none. */
    schedule: { date: CalendarDate; slot: string | null } | null;
    address: string[];
  };
  bundleName: string | null;
  pairs: OrderDetailPair[];
  /** The pipeline of a single-pair Order's pair, or of the Order's rollup with several. */
  timeline: TimelineStep[];
  payment: {
    /** The Order's Deposit Payment, or null if it has none. */
    deposit: Pick<Payment, "method" | "status" | "amount" | "receivedAt"> | null;
    estimate: Money;
    estimateIsMinimum: boolean;
    depositDue: Money;
    rush: Money | null;
    /** Once any live pair is quoted: the total when they all are (Rush included), else what's quoted so far. */
    quoted: { total: Money; complete: boolean; pairs: number; of: number } | null;
  };
  notes: OrderNote[];
}

/**
 * One Order's detail for the admin dialog: admin-only (ADR-0012). Null for
 * an id no Order has, so a stale or mistyped link shows "not found" instead
 * of failing the page.
 */
export async function getOrderDetail(deps: OrderDetailDeps, actingUser: ActingUser, orderId: string): Promise<OrderDetail | null> {
  requireRole(actingUser, "ADMIN");

  const order = await deps.orders.findById(orderId);
  if (!order) return null;
  const [notes, changes] = await Promise.all([deps.orders.listOrderNotes(order.id), deps.orders.listStatusChanges(order.id)]);

  const live = livePairs(order);
  const status = orderRollupStatus(order.items);
  const deposit = order.payments.find((payment) => payment.kind === "DEPOSIT");
  const { fulfillment } = order;
  const { address } = fulfillment;
  const schedule =
    fulfillment.method === "PICKUP"
      ? fulfillment.date
        ? { date: fulfillment.date, slot: fulfillment.slot || null }
        : null
      : fulfillment.preferredDate
        ? { date: fulfillment.preferredDate, slot: null }
        : null;

  return {
    orderId: order.id,
    reference: orderNumber(order.number),
    bookedAt: order.createdAt,
    status,
    customer: {
      name: order.contactName,
      email: order.contactEmail,
      phone: order.contactPhone,
      fulfillment: FULFILLMENT_LABELS[fulfillment.method],
      schedule,
      address: [address.line1, address.line2, `${address.city}, ${address.state} ${address.zip}`].filter((line): line is string => Boolean(line)),
    },
    bundleName: BUNDLE_CATALOG.find((bundle) => bundle.id === order.bundleId)?.name ?? null,
    pairs: await Promise.all(order.items.map((item) => toPair(item, order, deps.photoUrl))),
    timeline: buildTimeline(status, live.length > 0 ? live : order.items, changes, order.createdAt),
    payment: {
      deposit: deposit
        ? {
            method: deposit.method,
            status: deposit.status,
            amount: deposit.amount,
            receivedAt: deposit.receivedAt,
          }
        : null,
      estimate: live.length > 0 ? liveEstimate(order) : order.estimate,
      estimateIsMinimum: order.estimateIsMinimum,
      depositDue: order.deposit,
      rush: order.rush ? Money.fromCents(RUSH_FEE_CENTS) : null,
      quoted: quotedSummary(order),
    },
    notes,
  };
}

function quotedSummary(order: Order): OrderDetail["payment"]["quoted"] {
  const live = livePairs(order);
  const quoted = live.filter((item) => item.price !== null);
  if (quoted.length === 0) return null;
  const total = quotedTotal(order);
  return {
    total: total ?? quoted.reduce((sum, item) => sum.add(item.price!), Money.zero()),
    complete: total !== null,
    pairs: quoted.length,
    of: live.length,
  };
}

async function toPair(item: Item, order: Order, photoUrl: OrderDetailDeps["photoUrl"]): Promise<OrderDetailPair> {
  const inBundle = order.bundleId !== null;
  const { moves, held } = adminStatusMoves(item, order);
  const photoKey = item.photoKeys[0];
  return {
    itemId: item.id,
    photo: await pairPhoto(photoKey, photoUrl),
    title: [item.brand, item.model].filter(Boolean).join(" ") || null,
    details: [item.material, item.size && `Size ${item.size}`, item.colorway, item.description].filter((detail): detail is string => Boolean(detail)),
    estimate: item.estimate,
    price: item.price,
    status: item.status,
    services: SERVICE_CATALOG.filter((service) => item.serviceIds.includes(service.id)).map((service) => ({
      name: service.name,
      price: inBundle ? null : `${Money.fromCents(service.baseCents).format()}${service.isMinimum ? "+" : ""}`,
    })),
    nextStatuses: moves,
    held,
  };
}

/**
 * The pipeline as steps: done up to the Order's current status, then the
 * ones still to come. A done step carries when its pairs reached it, from
 * the audit log (the last of them, once every pair is there); it stays
 * untimed when the log has nothing, rather than guessing. The first step is
 * the booking itself. A cancelled Order stops where it was: the steps it
 * reached, then Cancelled.
 */
export function buildTimeline(status: ItemStatus, pairs: { id: string }[], changes: StatusChange[], bookedAt: Date): TimelineStep[] {
  /** When every pair had reached `step`, or null if any didn't or the log doesn't say. */
  const reachedAt = (step: ItemStatus): Date | null => {
    if (step === "REQUEST_SUBMITTED") return bookedAt;
    const times = pairs.map((pair) => changes.find((change) => change.itemId === pair.id && change.toStatus === step)?.at);
    return times.every((time): time is Date => time !== undefined) ? new Date(Math.max(...times.map((time) => time.getTime()))) : null;
  };

  const pipeline = ITEM_STATUSES.filter((step) => step !== "CANCELLED");
  if (status === "CANCELLED") {
    // Only what was reached, so a pair cancelled at review doesn't list "Completed".
    const reached = pipeline.flatMap((step): TimelineStep[] => {
      const at = reachedAt(step);
      return at ? [{ status: step, state: "done", at }] : [];
    });
    return [...reached, { status: "CANCELLED", state: "current", at: reachedAt("CANCELLED") }];
  }
  const current = pipeline.indexOf(status);
  return pipeline.map((step, index): TimelineStep => ({
    status: step,
    // Completed is a finished state, not a step still in progress.
    state: index < current || status === "COMPLETED" ? "done" : index === current ? "current" : "upcoming",
    at: index <= current ? reachedAt(step) : null,
  }));
}
