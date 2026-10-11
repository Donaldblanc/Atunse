import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { CalendarDate } from "@/features/orders/calendar-date";
import {
  adminStatusMoves,
  displayStatus,
  planBalance,
  canTransition,
  FULFILLMENT_LABELS,
  ITEM_STATUSES,
  liveEstimate,
  livePairs,
  orderNumber,
  orderDisplayStatus,
  orderRequiresQuote,
  statusPipeline,
  type Item,
  type ItemStatus,
  type Order,
  type Payment,
} from "@/features/orders/domain";
import type { OrderNote, OrderRepository, StatusChange } from "@/features/orders/repositories/order-repository";
import { addOnsCents, findBundle, itemRequiresQuote, RUSH_FEE_CENTS, formatPrice, SERVICE_CATALOG, SUEDE_FEE_CENTS, suedeFeeApplies } from "@/features/orders/service-catalog";
import { Money } from "@/shared/money/money";
import { PAIR_DETAIL_FIELDS, type PairDetailField } from "@/features/orders/order-details";
import { quotedTotal } from "@/features/orders/status-emails";
import { pairPhoto, type PairPhoto } from "./pair-photo";
import { summarizeReturnVisit, type ReturnVisitSummary } from "./return-booking";

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
  /** The stored status: what Update Status and the quote steps act on. */
  status: ItemStatus;
  /** What to show (displayStatus): a pair that needs no Quote reads Request Submitted until it moves past Approved. */
  displayStatus: ItemStatus;
  /** False for a Cleaning/Add-on-only pair (ADR-0017): no Send Quote or approval steps, and no quote-step statuses. */
  requiresQuote: boolean;
  /** The Services booked; a price is left off inside a Bundle, whose fixed price covers them. */
  services: { name: string; price: string | null; /** A "from" price: the real one depends on condition. */ isMinimum: boolean }[];
  /** The Suede Fee the catalog adds for this pair, or null (not Suede, nothing it applies to, or inside a Bundle, which waives it). */
  suedeFee: Money | null;
  /** Where Update Status can take this pair (adminStatusMoves in domain.ts). */
  nextStatuses: ItemStatus[];
  /** Why the next step isn't offered yet (awaiting the quote or the deposit), or null. */
  held: string | null;
  /** True when every Service was cleaning/add-on, so this pair skipped the Quote step straight to Approved at its estimate (ADR-0017). */
  autoApproved: boolean;
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
  /** The Order's one status as shown (orderDisplayStatus). */
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
  /** The Bundle's one fixed price as the Order stored it: live pairs' estimates less their Add-ons; null for an Order without a Bundle. */
  bundlePrice: Money | null;
  pairs: OrderDetailPair[];
  /** The pipeline of a single-pair Order's pair, or of the Order's rollup with several. */
  timeline: TimelineStep[];
  payment: {
    /** The Order's Deposit Payment, or null if it has none. */
    deposit: Pick<Payment, "method" | "status" | "amount" | "receivedAt"> | null;
    /** The Order's Balance Payment once its pairs are ready to go back, or null before then. */
    balance: (Pick<Payment, "method" | "status" | "amount" | "receivedAt"> & { id: string }) | null;
    /** What a Balance would be, when one should exist but doesn't (the Order was ready before Balances were recorded); else null. */
    balanceOwed: Money | null;
    estimate: Money;
    estimateIsMinimum: boolean;
    depositDue: Money;
    rush: Money | null;
    /** Once any live pair is quoted: the total when they all are (Rush included), else what's quoted so far. */
    quoted: { total: Money; complete: boolean; pairs: number; of: number } | null;
  };
  notes: OrderNote[];
  /** Local Drop-Off's Return visit: bookable, booked (when), or none. */
  returnVisit: ReturnVisitSummary;
  /** What Edit Order's form starts from: the stored values, and the Order's updatedAt for its optimistic check. */
  edit: OrderEditValues;
}

export interface OrderEditValues {
  /** ISO string of Order.updatedAt when this was read (round-trips to the millisecond, as the column stores). */
  updatedAt: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  /** Every pair, cancelled ones too (their details are still the customer's). */
  pairs: ({ itemId: string; label: string } & Record<PairDetailField, string>)[];
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

  const bundle = findBundle(order.bundleId);
  const live = livePairs(order);
  const status = orderDisplayStatus(order.items);
  const requiresQuote = live.length > 0 ? orderRequiresQuote(order) : order.items.some((item) => itemRequiresQuote(item.serviceIds));
  const deposit = order.payments.find((payment) => payment.kind === "DEPOSIT");
  const balance = order.payments.find((payment) => payment.kind === "BALANCE");
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
    bundleName: bundle?.name ?? null,
    bundlePrice: bundle
      ? Money.fromCents(
          live.reduce(
            (sum, item) =>
              sum +
              item.estimate.cents -
              addOnsCents(item.serviceIds.filter((id) => SERVICE_CATALOG.find((service) => service.id === id)?.isAddOn)),
            0,
          ),
        )
      : null,
    pairs: await Promise.all(order.items.map((item) => toPair(item, order, deps.photoUrl, changes))),
    timeline: buildTimeline(status, live.length > 0 ? live : order.items, changes, order.createdAt, requiresQuote),
    payment: {
      deposit: deposit
        ? {
            method: deposit.method,
            status: deposit.status,
            amount: deposit.amount,
            receivedAt: deposit.receivedAt,
          }
        : null,
      balance: balance ? { id: balance.id, method: balance.method, status: balance.status, amount: balance.amount, receivedAt: balance.receivedAt } : null,
      balanceOwed: missingBalance(order),
      estimate: live.length > 0 ? liveEstimate(order) : order.estimate,
      estimateIsMinimum: order.estimateIsMinimum,
      depositDue: order.deposit,
      rush: order.rush ? Money.fromCents(RUSH_FEE_CENTS) : null,
      quoted: quotedSummary(order),
    },
    notes,
    returnVisit: summarizeReturnVisit(order),
    edit: {
      updatedAt: order.updatedAt.toISOString(),
      contactName: order.contactName,
      contactEmail: order.contactEmail,
      contactPhone: order.contactPhone,
      line1: address.line1,
      line2: address.line2 ?? "",
      city: address.city,
      state: address.state,
      zip: address.zip,
      pairs: order.items.map((item, index) => ({
        itemId: item.id,
        label: order.items.length > 1 ? `Pair ${index + 1}` : "Pair",
        ...(Object.fromEntries(PAIR_DETAIL_FIELDS.map((field) => [field, item[field] ?? ""])) as Record<PairDetailField, string>),
      })),
    },
  };
}

/** The amount of the Balance the Order is missing, per planBalance, or null when none is missing. */
function missingBalance(order: Order): Money | null {
  const change = planBalance(order);
  return change.type === "create" ? change.amount : null;
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

async function toPair(item: Item, order: Order, photoUrl: OrderDetailDeps["photoUrl"], changes: StatusChange[]): Promise<OrderDetailPair> {
  const inBundle = order.bundleId !== null;
  const { moves, held } = adminStatusMoves(item, order);
  const photoKey = item.photoKeys[0];
  const services = SERVICE_CATALOG.filter((service) => item.serviceIds.includes(service.id));
  // No Restoration/Custom-Work Service, so it was created already Approved at its estimate
  // (ADR-0017), never through Under Review / Quote Sent. Keyed off the Service category, not
  // status history: a plain Update Status move (adminStatusMoves) can jump a Restoration pair
  // straight to Approved too, with no Quote Sent in its history, and that pair still needs one.
  const autoApproved =
    item.status !== "REQUEST_SUBMITTED" &&
    item.status !== "UNDER_REVIEW" &&
    item.status !== "QUOTE_SENT" &&
    item.status !== "CANCELLED" &&
    !services.some((service) => service.category === "restoration" || service.category === "custom-work") &&
    !changes.some((change) => change.itemId === item.id && change.toStatus === "QUOTE_SENT");
  const suedeApplies = !inBundle && suedeFeeApplies(item.material, services);
  return {
    itemId: item.id,
    photo: await pairPhoto(photoKey, photoUrl),
    title: [item.brand, item.model].filter(Boolean).join(" ") || null,
    details: [item.material, item.size && `Size ${item.size}`, item.colorway, item.description].filter((detail): detail is string => Boolean(detail)),
    estimate: item.estimate,
    price: item.price,
    status: item.status,
    displayStatus: displayStatus(item.status, itemRequiresQuote(item.serviceIds)),
    requiresQuote: itemRequiresQuote(item.serviceIds),
    services: services.map((service) => ({
      name: service.name,
      // A Bundle's price covers its own Services; Add-ons are charged on top.
      price: inBundle && !service.isAddOn ? null : formatPrice(service.baseCents, service.isMinimum),
      isMinimum: !(inBundle && !service.isAddOn) && service.isMinimum,
    })),
    suedeFee: suedeApplies ? Money.fromCents(SUEDE_FEE_CENTS) : null,
    nextStatuses: moves,
    held,
    autoApproved,
  };
}

/**
 * The pipeline as steps: done up to the Order's current status, then the
 * ones still to come. A done step carries when its pairs reached it, from
 * the audit log (the last of them, once every pair is there, each pair's
 * latest time if it stepped back and reached it again); it stays
 * untimed when the log has nothing, rather than guessing. The first step is
 * the booking itself. A cancelled Order stops where it was: the steps it
 * reached, then Cancelled. `status` is the displayed one; an Order with no pair
 * needing a Quote skips Under Review, Quote Sent and Approved (statusPipeline).
 */
export function buildTimeline(status: ItemStatus, pairs: { id: string }[], changes: StatusChange[], bookedAt: Date, requiresQuote = true): TimelineStep[] {
  /** When every pair had reached `step`, or null if any didn't or the log doesn't say. */
  const reachedAt = (step: ItemStatus): Date | null => {
    if (step === "REQUEST_SUBMITTED") return bookedAt;
    // The latest entry: a pair stepped back and moved on again shows when it reached the step this time.
    const times = pairs.map((pair) => changes.findLast((change) => change.itemId === pair.id && change.toStatus === step)?.at);
    return times.every((time): time is Date => time !== undefined) ? new Date(Math.max(...times.map((time) => time.getTime()))) : null;
  };

  const pipeline = statusPipeline(requiresQuote);
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
