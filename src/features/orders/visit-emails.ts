// What the customer is told when the owner moves their visit or books their
// Return. Plain and warm, in the house style of the booking confirmation
// (submit-order.ts): the customer's words are Local Drop-Off, collect and
// drop off, never internal statuses or "pickup".

import type { EmailMessage } from "@/features/notifications/notification-service";
import { SHOP_TIMEZONE } from "./calendar-date";
import { orderNumber, type Address, type Appointment, type Order } from "./domain";

const day = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: SHOP_TIMEZONE });
const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: SHOP_TIMEZONE });

type EmailOrder = Pick<Order, "number" | "contactName" | "contactEmail" | "fulfillment">;
type Window = { startsAt: Date; endsAt: Date };

/** "Friday, October 3, 4:30 PM – 5:00 PM", shop time. */
export function visitWhen({ startsAt, endsAt }: Window): string {
  return `${day.format(startsAt)}, ${clock.format(startsAt)} – ${clock.format(endsAt)}`;
}

function oneLine(address: Address): string {
  return [address.line1, address.line2, `${address.city}, ${address.state} ${address.zip}`].filter(Boolean).join(", ");
}

const CLOSING = "If that doesn't work for you, just reply to this email and we'll find another time.";

/** The email for a visit moved from `was` to `now`; `kind` decides the wording. */
export function rescheduledEmail(order: EmailOrder, kind: Appointment["kind"], was: Window, now: Window): EmailMessage {
  const reference = orderNumber(order.number);
  const what = kind === "COLLECTION" ? "collect your sneakers" : "drop your sneakers back off";
  return {
    to: order.contactEmail,
    subject: `New time for your ${kind === "COLLECTION" ? "collection" : "return"} (${reference})`,
    body: [
      `Hi ${order.contactName}, we've changed the time DJ will ${what} for your booking ${reference}.`,
      `New time: ${visitWhen(now)}\nAddress: ${oneLine(order.fulfillment.address)}\n(It was ${visitWhen(was)}.)`,
      `Sorry for the change. ${CLOSING}`,
    ].join("\n\n"),
  };
}

/** The email for a newly booked Return: the work is done and DJ is bringing the sneakers back. */
export function returnBookedEmail(order: EmailOrder, when: Window): EmailMessage {
  const reference = orderNumber(order.number);
  return {
    to: order.contactEmail,
    subject: `Your sneakers are ready to come home (${reference})`,
    body: [
      `Hi ${order.contactName}, good news: your sneakers from booking ${reference} are ready, and DJ will drop them back off.`,
      `When: ${visitWhen(when)}\nAddress: ${oneLine(order.fulfillment.address)}`,
      CLOSING,
    ].join("\n\n"),
  };
}
