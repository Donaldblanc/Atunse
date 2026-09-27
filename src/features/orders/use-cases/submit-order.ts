import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { isValidEmail, isValidUsPhone, isValidZip } from "@/features/booking/contact-rules";
import { PICKUP_STATES, PICKUP_TIME_SLOTS, US_STATES } from "@/features/booking/pickup-window";
import type { NotificationService } from "@/features/notifications/notification-service";
import { orderReference, type CalendarDate, type Fulfillment, type Order } from "../domain";
import type { PaymentInstructions } from "../payment-instructions";
import { isBookingPhotoKey, MAX_PHOTOS_PER_ITEM } from "../photo-keys";
import { AccountExistsError, type OrderRepository } from "../repositories/order-repository";
import {
  estimateItem,
  estimateOrder,
  InvalidServiceSelectionError,
  MATERIALS,
  type Material,
} from "../service-catalog";

export interface SubmitOrderInput {
  /** Client-generated once per booking; a retry with the same key is a no-op (ADR-0012). */
  submissionKey: string | null;
  policyAccepted: boolean; // captured at submission itself, not deferred
  contact: { name: string; email: string; phone: string };
  fulfillment: Fulfillment;
  rush: boolean;
  item: {
    brand: string | null;
    material: string | null;
    notes: string | null;
    serviceIds: string[];
    photoKeys: string[]; // from presigned uploads (ADR-0004) — never raw file bytes
  };
}

export interface SubmitOrderDeps {
  orders: OrderRepository;
  notifications: NotificationService;
  paymentInstructions: PaymentInstructions;
  /** FEATURE_CUSTOMER_SIGN_IN_ENABLED: decides what an existing email does (ADR-0014). */
  customerSignInEnabled: boolean;
  now?: () => Date;
}

export class PolicyNotAcceptedError extends Error {
  constructor() {
    super("Order cannot be submitted without accepting the required policies.");
  }
}

/**
 * A signed-out booking used an email that already has an Account, with
 * customer login on. The customer signs in with an emailed code (the
 * booking flow's login screen) and resubmits (ADR-0014).
 */
export class SignInRequiredError extends Error {
  constructor(readonly email: string) {
    super("You already have an account with this email. Sign in to finish your booking.");
    this.name = "SignInRequiredError";
  }
}

/** The booking breaks a domain rule; `message` is safe to show the customer. */
export class BookingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingValidationError";
  }
}

// The shop runs on New York time, so "today" for past-date checks is NY's.
const SHOP_TIMEZONE = "America/New_York";
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Phase 1 vertical slice, step 1: a customer books one pair through
 * /booking. Every Order belongs to an Account (ADR-0014): a signed-in
 * customer's own, or a Customer Account created with the Order from the
 * booking's email and phone. Every ADR-0012 concern is present: authz
 * (anyone can submit, but the check is still explicit), business rules
 * enforced server-side (Policy Acceptance, Pickup area, Service rules),
 * money computed from the server's own catalog, idempotency on the
 * submission key, and a notification on the resulting state.
 */
export async function submitOrder(deps: SubmitOrderDeps, actingUser: ActingUser, input: SubmitOrderInput): Promise<Order> {
  requireRole(actingUser, "GUEST", "CUSTOMER");

  if (!input.policyAccepted) {
    throw new PolicyNotAcceptedError();
  }

  const now = deps.now?.() ?? new Date();

  // A retry of a submission that already went through gets its Order back
  // before any other check: its photo keys are, by design, already in use.
  if (input.submissionKey) {
    const existing = await deps.orders.findBySubmissionKey(input.submissionKey);
    if (existing) return sendConfirmationOnce(deps, existing, now);
  }

  const today = shopToday(now);
  const contact = validateContact(input.contact);
  const fulfillment = validateFulfillment(input.fulfillment, today);
  const material = validateMaterial(input.item.material);
  validatePhotoKeys(input.item.photoKeys);

  let itemEstimate;
  try {
    itemEstimate = estimateItem({ serviceIds: input.item.serviceIds, material });
  } catch (err) {
    if (err instanceof InvalidServiceSelectionError) throw new BookingValidationError(err.message);
    throw err;
  }
  const orderEstimate = estimateOrder({ items: [itemEstimate], rush: input.rush });

  // A photo belongs to exactly one booking, so another Order can never gain
  // view access to it by quoting its key (ADR-0014).
  if ((await deps.orders.findPhotoKeysInUse(input.item.photoKeys)).length > 0) {
    throw new BookingValidationError("One or more photos are already attached to another booking. Upload them again.");
  }

  const owner =
    actingUser.role === "CUSTOMER" && actingUser.accountId
      ? { accountId: actingUser.accountId }
      : {
          newCustomer: { email: contact.email.toLowerCase(), phone: contact.phone },
          // With customer login on, an existing email must sign in first;
          // with it off, nobody can sign in to see anything, so attaching
          // the Order to the existing Account exposes nothing.
          ifEmailRegistered: deps.customerSignInEnabled ? ("fail" as const) : ("attach" as const),
        };

  let created;
  try {
    created = await deps.orders.create({
      owner,
      contactName: contact.name,
      contactEmail: contact.email,
      contactPhone: contact.phone,
      policyAcceptedAt: now,
      fulfillment,
      rush: input.rush,
      estimate: orderEstimate.estimate,
      estimateIsMinimum: orderEstimate.isMinimum,
      deposit: orderEstimate.deposit,
      submissionKey: input.submissionKey,
      item: {
        brand: blankToNull(input.item.brand),
        model: null, // the booking form's single "Brand / Model" field lands in `brand`
        description: blankToNull(input.item.notes),
        material,
        serviceIds: input.item.serviceIds,
        estimate: itemEstimate.estimate,
        photoKeys: input.item.photoKeys,
      },
    });
  } catch (err) {
    if (err instanceof AccountExistsError) throw new SignInRequiredError(contact.email);
    throw err;
  }

  return sendConfirmationOnce(deps, created.order, now);
}

// Sent until it succeeds once: a retry after a failed send (the route
// returned 500) sends it, and a retry after a successful one doesn't.
async function sendConfirmationOnce(deps: SubmitOrderDeps, order: Order, now: Date): Promise<Order> {
  if (!order.confirmationEmailSentAt) {
    await deps.notifications.sendEmail({
      to: order.contactEmail,
      subject: `We received your booking (${orderReference(order.id)})`,
      body: confirmationEmailBody(order, deps.paymentInstructions),
    });
    await deps.orders.markConfirmationEmailSent(order.id, now);
    order.confirmationEmailSentAt = now;
  }

  return order;
}

function validateContact(contact: SubmitOrderInput["contact"]) {
  const name = contact.name.trim();
  const email = contact.email.trim();
  const phone = contact.phone.trim();
  if (!name) throw new BookingValidationError("Enter your name.");
  if (!isValidEmail(email)) throw new BookingValidationError("Enter a valid email address.");
  if (!isValidUsPhone(phone)) throw new BookingValidationError("Enter a valid 10-digit US phone number.");
  return { name, email, phone };
}

function validateFulfillment(fulfillment: Fulfillment, today: CalendarDate): Fulfillment {
  const address = {
    line1: fulfillment.address.line1.trim(),
    line2: blankToNull(fulfillment.address.line2),
    city: fulfillment.address.city.trim(),
    state: fulfillment.address.state.trim().toUpperCase(),
    zip: fulfillment.address.zip.trim(),
  };
  if (!address.line1 || !address.city) throw new BookingValidationError("Enter your street address and city.");
  if (!isValidZip(address.zip)) throw new BookingValidationError("Enter a valid 5-digit zip code.");

  if (fulfillment.method === "PICKUP") {
    if (!(PICKUP_STATES as readonly string[]).includes(address.state)) {
      throw new BookingValidationError("Pickup is only available in NY, NJ and CT. Choose Mail-In instead.");
    }
    if (!isValidCalendarDate(fulfillment.date) || fulfillment.date < today) {
      throw new BookingValidationError("Choose a pickup date from today onward.");
    }
    if (!PICKUP_TIME_SLOTS.includes(fulfillment.slot)) {
      throw new BookingValidationError("Choose a pickup time between 4:30 PM and 10:00 PM.");
    }
    return { method: "PICKUP", address, date: fulfillment.date, slot: fulfillment.slot };
  }

  if (!(US_STATES as readonly string[]).includes(address.state)) {
    throw new BookingValidationError("Choose a US state for your shipping address.");
  }
  const { preferredDate } = fulfillment;
  if (preferredDate !== null && (!isValidCalendarDate(preferredDate) || preferredDate < today)) {
    throw new BookingValidationError("Choose a mail-in date from today onward.");
  }
  return { method: "MAIL_IN", address, preferredDate };
}

function validateMaterial(material: string | null): Material | null {
  const value = blankToNull(material);
  if (value === null) return null;
  if (!(MATERIALS as readonly string[]).includes(value)) {
    throw new BookingValidationError(`Unknown material: ${value}`);
  }
  return value as Material;
}

function validatePhotoKeys(photoKeys: string[]) {
  if (photoKeys.length === 0) throw new BookingValidationError("Add at least one photo of your pair.");
  if (photoKeys.length > MAX_PHOTOS_PER_ITEM) {
    throw new BookingValidationError(`Add at most ${MAX_PHOTOS_PER_ITEM} photos per pair.`);
  }
  if (!photoKeys.every(isBookingPhotoKey)) throw new BookingValidationError("One or more photos weren't uploaded.");
}

function isValidCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function shopToday(now: Date): CalendarDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TIMEZONE }).format(now);
}

function blankToNull(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function confirmationEmailBody(order: Order, payment: PaymentInstructions): string {
  const reference = orderReference(order.id);
  const estimate = `${order.estimateIsMinimum ? "from " : ""}${order.estimate.format()}`;
  const howToPay = payment.zelle
    ? `Pay the ${order.deposit.format()} deposit by Zelle to ${payment.zelle.recipient} (${payment.zelle.name}) with "${reference}" in the memo.`
    : `We'll email you how to pay the ${order.deposit.format()} deposit.`;
  const nextStep =
    order.fulfillment.method === "PICKUP"
      ? `We'll pick up your pair on ${order.fulfillment.date}, ${order.fulfillment.slot}.`
      : "We'll email you where to ship your pair.";
  return [
    `Thanks, ${order.contactName}. Your booking ${reference} was received.`,
    `Estimated total: ${estimate}. Deposit due: ${order.deposit.format()}.`,
    howToPay,
    nextStep,
    "We'll inspect your sneakers and confirm final pricing before any work begins.",
  ].join("\n\n");
}
