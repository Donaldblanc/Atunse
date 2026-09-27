import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { isValidEmail, isValidUsPhone, isValidZip } from "../contact-rules";
import { availablePickupSlots, PICKUP_LEAD_MINUTES, PICKUP_STATES, PICKUP_TIME_SLOTS, US_STATES } from "../pickup-window";
import type { NotificationService } from "@/features/notifications/notification-service";
import { calendarDateInShopTime, isCalendarDate } from "../calendar-date";
import { orderReference, type Fulfillment, type Order } from "../domain";
import type { PaymentInstructions } from "../payment-instructions";
import type { FileStorage } from "@/shared/storage";
import { isBookingPhotoKey, MAX_PHOTOS_PER_ITEM, photoMatchesKey } from "../photo-keys";
import { submissionFingerprint } from "../submission-fingerprint";
import type { AccountRepository } from "@/features/accounts/repositories/account-repository";
import {
  EmailTakenError,
  PhotoKeyInUseError,
  type OrderOwner,
  type OrderRepository,
} from "../repositories/order-repository";
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
  /** Customer Accounts only: Admin Accounts are a separate identity (ADR-0014). */
  accounts: AccountRepository;
  /** Where the booking's photos were uploaded; checked before the Order is created (#77). */
  storage: FileStorage;
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
  constructor() {
    super("You already have an account with this email. Sign in to finish your booking.");
    this.name = "SignInRequiredError";
  }
}

/**
 * The submission key already created an Order, but with different booking
 * details (#76). Returning that Order would show the customer a booking
 * they've since changed, so they're pointed at the one that went through.
 */
export class SubmissionConflictError extends Error {
  constructor(readonly reference: string) {
    super(
      `We already received this booking (reference ${reference}) before your changes. ` +
        "Check your email for its details, and reply there to change anything.",
    );
    this.name = "SubmissionConflictError";
  }
}

/** The booking breaks a domain rule; `message` is safe to show the customer. */
export class BookingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingValidationError";
  }
}


/**
 * Phase 1 vertical slice, step 1: a customer books one pair through
 * /booking. Every Order belongs to a Customer Account (ADR-0014), resolved
 * by resolveOwner below: never an Admin Account, even for an admin's email. Every ADR-0012 concern is present: authz
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
  // before any other check: its photo keys are, by design, already in use,
  // and a date that was valid then may have passed since (#76).
  const fingerprint = input.submissionKey ? submissionFingerprint(input) : null;
  if (input.submissionKey) {
    const existing = await deps.orders.findBySubmissionKey(input.submissionKey);
    if (existing) return sendConfirmationOnce(deps, sameSubmission(existing, fingerprint), now);
  }

  const contact = validateContact(input.contact);
  const fulfillment = validateFulfillment(input.fulfillment, now);
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
  await verifyUploadedPhotos(deps.storage, input.item.photoKeys);

  const newOrder = (owner: OrderOwner) =>
    deps.orders.create({
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
      submissionFingerprint: fingerprint,
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

  let created;
  try {
    try {
      created = await newOrder(await resolveOwner(deps, actingUser, contact));
    } catch (err) {
      // A concurrent first booking created this email's Customer Account
      // after our lookup: resolve again, now against that Account.
      if (!(err instanceof EmailTakenError)) throw err;
      created = await newOrder(await resolveOwner(deps, actingUser, contact));
    }
  } catch (err) {
    // The database's unique photo key: a photo belongs to exactly one
    // booking, so another Order can never gain view access to it.
    if (err instanceof PhotoKeyInUseError) {
      throw new BookingValidationError("One or more photos are already attached to another booking. Upload them again.");
    }
    throw err;
  }

  // created is false when a concurrent request with the same key won.
  const order = created.created ? created.order : sameSubmission(created.order, fingerprint);
  return sendConfirmationOnce(deps, order, now);
}

/** The existing Order for a reused submission key, if it was the same booking (#76). */
function sameSubmission(existing: Order, fingerprint: string | null): Order {
  if (existing.submissionFingerprint !== null && existing.submissionFingerprint !== fingerprint) {
    throw new SubmissionConflictError(orderReference(existing.id));
  }
  return existing;
}

/**
 * Which Customer Account the booking belongs to (ADR-0014):
 * - A signed-in customer booking under their own email: their Account.
 *   Under a different email (e.g. someone else on a shared browser), the
 *   session is ignored and the booking is treated as signed out, so it
 *   never lands in the wrong person's Account.
 * - Signed out, new email: a new Customer Account.
 * - Signed out, an email with a Customer Account: with customer login on,
 *   they must sign in first; with it off, the Order attaches (nobody can
 *   sign in to see it, so nothing is exposed).
 * Admin Accounts never come into it: an admin's email books like any
 * other, into a Customer Account of its own.
 */
async function resolveOwner(
  deps: SubmitOrderDeps,
  actingUser: ActingUser,
  contact: { email: string; phone: string },
): Promise<OrderOwner> {
  const email = contact.email.toLowerCase();
  if (actingUser.role === "CUSTOMER" && actingUser.accountId) {
    const session = await deps.accounts.findCustomerById(actingUser.accountId);
    if (session?.email === email) return { accountId: session.id };
  }

  const existing = await deps.accounts.findCustomerByEmail(email);
  if (!existing) return { newCustomer: { email, phone: contact.phone } };
  if (deps.customerSignInEnabled) throw new SignInRequiredError();
  return { accountId: existing.id };
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

function validateFulfillment(fulfillment: Fulfillment, now: Date): Fulfillment {
  // "Today" and slot availability are the shop's (New York's), the same
  // rules the booking picker uses (pickup-window.ts, #75).
  const today = calendarDateInShopTime(now);
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
    if (!isCalendarDate(fulfillment.date) || fulfillment.date < today) {
      throw new BookingValidationError("Choose a pickup date from today onward.");
    }
    if (!PICKUP_TIME_SLOTS.includes(fulfillment.slot)) {
      throw new BookingValidationError("Choose a pickup time between 4:30 PM and 10:00 PM.");
    }
    if (!availablePickupSlots(fulfillment.date, now).includes(fulfillment.slot)) {
      throw new BookingValidationError(
        `That pickup time is no longer available. Same-day pickups need at least ${PICKUP_LEAD_MINUTES / 60} hours' notice.`,
      );
    }
    return { method: "PICKUP", address, date: fulfillment.date, slot: fulfillment.slot };
  }

  if (!(US_STATES as readonly string[]).includes(address.state)) {
    throw new BookingValidationError("Choose a US state for your shipping address.");
  }
  const { preferredDate } = fulfillment;
  if (preferredDate !== null && (!isCalendarDate(preferredDate) || preferredDate < today)) {
    throw new BookingValidationError("Choose a mail-in date from today onward.");
  }
  return { method: "MAIL_IN", address, preferredDate };
}

/**
 * Every photo must really be in storage and really be the image type its
 * key promises (#77). Keys are server-minted, but a key alone doesn't prove
 * the upload finished, and a target's pinned Content-Type is only a label
 * on whatever bytes were sent.
 */
async function verifyUploadedPhotos(storage: FileStorage, photoKeys: string[]) {
  const stored = await Promise.all(photoKeys.map((key) => storage.inspect(key)));
  if (stored.some((object) => object === null || object.size === 0)) {
    throw new BookingValidationError("One or more photos didn't finish uploading. Please try again.");
  }
  if (stored.some((object, i) => !photoMatchesKey(photoKeys[i]!, object!.head))) {
    throw new BookingValidationError("One or more photos aren't valid JPEG, PNG, WebP or HEIC images.");
  }
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
