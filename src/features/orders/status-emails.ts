// The customer emails for the status changes that matter to them (owner's
// decision): the quote arriving, the pair being ready to come back, and a
// cancellation. Every other step is internal and stays silent. Pure text
// composition, no I/O, so the copy can be unit-tested; use-cases send it
// after the database write succeeds and never on an idempotent replay.
//
// House style follows submit-order.ts's booking confirmation: plain and
// warm, "Local Drop-Off" / "Mail-In" (never "pickup"), never a status code.
// Each function takes the Order as it is AFTER the change, so "every pair
// is cancelled" and "quoted so far" read the new state.

import { Money } from "@/shared/money/money";
import { livePairs, orderNumber, type Item, type ItemStatus, type Order } from "./domain";
import { RUSH_FEE_CENTS } from "./service-catalog";

export interface StatusEmail {
  subject: string;
  body: string;
}

/** "your pair" for a single-pair Order; "Pair 2 (Nike Air Max 90)" when the Order has several. */
function pairName(order: Order, item: Item): string {
  if (order.items.length === 1) return "your pair";
  const title = [item.brand, item.model].filter(Boolean).join(" ");
  return `Pair ${order.items.indexOf(item) + 1}${title ? ` (${title})` : ""}`;
}

/** The Order's price once every pair that's still live is quoted, or null while any isn't. Rush is an Order-level charge on top of the pairs. */
export function quotedTotal(order: Order): Money | null {
  const live = livePairs(order);
  if (live.length === 0 || live.some((item) => item.price === null)) return null;
  const pairs = live.reduce((sum, item) => sum.add(item.price!), Money.zero());
  return order.rush ? pairs.add(Money.fromCents(RUSH_FEE_CENTS)) : pairs;
}

function depositLine(order: Order): string | null {
  const deposit = order.payments.find((payment) => payment.kind === "DEPOSIT");
  if (!deposit || deposit.status === "FAILED" || deposit.status === "REFUNDED") return null;
  return deposit.status === "RECEIVED"
    ? `Your ${deposit.amount.format()} deposit is already paid, and it won't be charged again.`
    : `Your ${deposit.amount.format()} deposit is still to be paid. We can start as soon as it arrives.`;
}

/** What's left after the Deposit, once the whole Order is quoted; null when there's no balance to name. */
function balanceLine(order: Order, when: string): string | null {
  const total = quotedTotal(order);
  const deposit = order.payments.find((payment) => payment.kind === "DEPOSIT");
  if (!total || !deposit) return null;
  const balance = total.subtract(deposit.amount);
  return balance.cents > 0 ? `The remaining balance of ${balance.format()} is due ${when}.` : null;
}

/**
 * Quote Sent: this pair's real price, the Order's quoted total so far, and
 * what happens to the Deposit. CONTEXT.md (Balance Delta): the customer is
 * told the real total the moment the Quote is sent, and the Deposit is never
 * re-charged; the difference is settled in the Balance at completion.
 */
export function quoteSentEmail(order: Order, item: Item): StatusEmail {
  const reference = orderNumber(order.number);
  const price = item.price;
  if (!price) throw new Error("quoteSentEmail needs a pair with a price");
  const name = pairName(order, item);
  const single = order.items.length === 1;
  const live = livePairs(order);
  const quoted = live.filter((pair) => pair.price !== null);

  const lines = [
    `Hi ${order.contactName},`,
    single
      ? `We've looked over your sneakers and your quote for booking ${reference} is ready: ${price.format()}.`
      : `We've looked over ${name} from booking ${reference}, and your quote for it is ready: ${price.format()}.`,
  ];

  const difference = price.subtract(item.estimate);
  if (difference.cents !== 0) {
    lines.push(
      `That's ${difference.cents > 0 ? `${difference.format()} more` : `${Money.fromCents(-difference.cents).format()} less`} than the ${item.estimate.format()} estimate from when you booked, now that we've seen the pair in detail.`,
    );
  }

  const total = quotedTotal(order);
  if (!single && total) {
    lines.push(`Every pair on ${reference} is now quoted, for a total of ${total.format()}${order.rush ? ` (including the ${Money.fromCents(RUSH_FEE_CENTS).format()} Rush fee)` : ""}.`);
  } else if (!single) {
    const soFar = quoted.reduce((sum, pair) => sum.add(pair.price!), Money.zero());
    lines.push(`Quoted so far on ${reference}: ${soFar.format()} across ${quoted.length} of ${live.length} pairs. We'll send the rest as we look at them.`);
  } else if (total && order.rush) {
    lines.push(`With the ${Money.fromCents(RUSH_FEE_CENTS).format()} Rush fee, your total is ${total.format()}.`);
  }

  const deposit = depositLine(order);
  if (deposit) lines.push(deposit);
  const balance = balanceLine(order, "before your sneakers come back to you");
  if (balance) lines.push(balance);

  lines.push(`If you'd like us to go ahead${single ? "" : ` with ${name}`}, just let DJ know by text, call or by replying to this email. We won't start until you say yes.`);
  return { subject: `Your quote for ${reference}`, body: lines.join("\n\n") };
}

/** Ready for Drop-Off/Shipping: wording differs by Fulfillment Method (CONTEXT.md). */
export function readyEmail(order: Order, item: Item): StatusEmail {
  const reference = orderNumber(order.number);
  const single = order.items.length === 1;
  const name = pairName(order, item);
  const { fulfillment } = order;
  const { address } = fulfillment;
  const place = `${address.line1}, ${address.city}, ${address.state} ${address.zip}`;

  const lines = [
    `Hi ${order.contactName},`,
    single ? `Good news: your sneakers from booking ${reference} are finished and ready to come back to you.` : `Good news: ${name} from booking ${reference} is finished and ready to come back to you.`,
    fulfillment.method === "PICKUP"
      ? `Local Drop-Off: DJ will bring ${single ? "them" : "it"} back to ${place}. We'll be in touch to settle a time.`
      : `Mail-In: ${single ? "they're" : "it's"} ready to ship back to ${place}, and we'll send ${single ? "them" : "it"} on shortly.`,
  ];
  const balance = balanceLine(order, fulfillment.method === "PICKUP" ? "when DJ brings them back" : "before we ship them");
  if (balance) lines.push(balance);
  lines.push("Thank you for trusting us with your sneakers.");
  return { subject: `Your sneakers are ready (${reference})`, body: lines.join("\n\n") };
}

/**
 * Cancelled: for the whole Order when every pair is now cancelled, else for
 * just this pair. Says nothing about a refund beyond "we'll be in touch",
 * since the Deposit's handling is the owner's call (nothing in the docs).
 */
export function cancelledEmail(order: Order, item: Item): StatusEmail {
  const reference = orderNumber(order.number);
  const wholeOrder = livePairs(order).length === 0;
  const deposit = order.payments.find((payment) => payment.kind === "DEPOSIT");
  const lines = [
    `Hi ${order.contactName},`,
    wholeOrder
      ? `Your booking ${reference} has been cancelled, and we won't be doing any work on ${order.items.length === 1 ? "your pair" : "your pairs"}.`
      : `${pairName(order, item)} from booking ${reference} has been cancelled, and we won't be doing any work on it. The rest of your booking carries on as planned.`,
  ];
  if (deposit?.status === "RECEIVED") lines.push("We'll be in touch about your deposit.");
  lines.push("If this isn't what you expected, or you have any questions, just reply to this email and DJ will help.");
  return { subject: wholeOrder ? `Your booking ${reference} was cancelled` : `A pair on ${reference} was cancelled`, body: lines.join("\n\n") };
}

/** The statuses whose arrival emails the customer (statusChangeEmail); every other step stays silent. */
export const EMAILED_STATUSES: readonly ItemStatus[] = ["READY_FOR_PICKUP_SHIPPING", "CANCELLED"];

/** The email for the status an Item just reached, or null for the steps that stay silent. */
export function statusChangeEmail(order: Order, item: Item): StatusEmail | null {
  switch (item.status) {
    case "READY_FOR_PICKUP_SHIPPING":
      return readyEmail(order, item);
    case "CANCELLED":
      return cancelledEmail(order, item);
    default:
      return null;
  }
}
