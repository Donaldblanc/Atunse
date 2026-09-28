import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { isValidEmail, isValidUsPhone, isValidZip } from "../contact-rules";
import { availablePickupSlots, PICKUP_LEAD_MINUTES, PICKUP_STATES, PICKUP_TIME_SLOTS, US_STATES } from "../pickup-window";
import type { NotificationService } from "@/features/notifications/notification-service";
import { calendarDateInShopTime, isCalendarDate } from "../calendar-date";
import { orderReference, pairsPhrase, type Fulfillment, type Order } from "../domain";
import type { PaymentInstructions } from "../payment-instructions";
import { mapWithConcurrency } from "@/shared/concurrency";
import type { FileStorage } from "@/shared/storage";
import { randomUUID } from "node:crypto";
import { isBookingPhotoKey, MAX_PHOTOS_PER_ITEM, photoKeyContentType, photoMatchesKey, storedPhotoKey } from "../photo-keys";
import { submissionFingerprint } from "../submission-fingerprint";
import { acknowledgesAll, acknowledgmentRecord } from "../booking-terms";
import { TERMS_AGREEMENT } from "@/shared/legal-documents";
import type { AccountRepository } from "@/features/accounts/repositories/account-repository";
import {
  EmailTakenError,
  PhotoKeyInUseError,
  type OrderOwner,
  type OrderRepository,
} from "../repositories/order-repository";
import {
  BUNDLE_PAIR_SERVICE_IDS,
  BUNDLE_PAIRS,
  estimateBundleItems,
  estimateItem,
  estimateOrder,
  findBundle,
  InvalidServiceSelectionError,
  MATERIALS,
  type ItemEstimate,
  type Material,
} from "../service-catalog";

export interface SubmitOrderInput {
  /** Client-generated once per booking; a retry with the same key is a no-op (ADR-0012). */
  submissionKey: string | null;
  policyAccepted: boolean; // captured at submission itself, not deferred
  /** The BOOKING_ACKNOWLEDGMENTS ids the customer ticked: all of them, or the booking is refused. */
  acknowledgedTerms: string[];
  /**
   * The TERMS_AGREEMENT version the booking page showed. Must be the
   * current one, so the recorded acceptance is of the agreement the
   * customer actually saw (ADR-0015).
   */
  termsVersion: string;
  contact: { name: string; email: string; phone: string };
  fulfillment: Fulfillment;
  rush: boolean;
  /** A Bundle id (service-catalog.ts) for three pairs, or null for a single pair. */
  bundleId: string | null;
  /** One entry per pair: exactly one without a Bundle, BUNDLE_PAIRS with one. */
  items: PairInput[];
}

export interface PairInput {
  brand: string | null;
  material: string | null;
  notes: string | null;
  /**
   * The pair's Services, Add-ons included. In a Bundle, only the pair's
   * Add-ons (often none): its other Services come with the Bundle.
   */
  serviceIds: string[];
  photoKeys: string[]; // from presigned uploads (ADR-0004) — never raw file bytes
}

export interface SubmitOrderDeps {
  orders: OrderRepository;
  /** Customer Accounts only: Admin Accounts are a separate identity (ADR-0014). */
  accounts: AccountRepository;
  /** Where the booking's photos were uploaded; copied and checked before the Order is created (#77). */
  storage: FileStorage;
  newId?: () => string;
  notifications: NotificationService;
  paymentInstructions: PaymentInstructions;
  /** FEATURE_CUSTOMER_SIGN_IN_ENABLED: decides what an existing email does (ADR-0014). */
  customerSignInEnabled: boolean;
  now?: () => Date;
}

export class PolicyNotAcceptedError extends Error {
  constructor() {
    // A booking tab opened before the acknowledgments shipped, or before
    // the agreement's current version, doesn't show them: hence the
    // reload hint.
    super(
      "Tick each acknowledgment and agree to the Terms of Service & Restoration Agreement to confirm your booking. " +
        "Don't see them? Reload the page.",
    );
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
  readonly reference: string;

  /** `existing` is the Order the key created, so the client can show it. */
  constructor(readonly existing: Order) {
    const reference = orderReference(existing.id);
    super(
      `We already received this booking (reference ${reference}) before your changes. ` +
        "Check your email for its details, and reply there to change anything.",
    );
    this.name = "SubmissionConflictError";
    this.reference = reference;
  }
}

/** The booking breaks a domain rule; `message` is safe to show the customer. */
export class BookingValidationError extends Error {
  /** Set when the client can do something specific about it. */
  readonly code?: string;

  constructor(message: string) {
    super(message);
    this.name = "BookingValidationError";
  }
}

/**
 * A photo the booking names isn't in storage (never finished uploading, or
 * cleaned up since). The code tells the booking client to upload the
 * photos again rather than resend the same keys.
 */
export class PhotosNotUploadedError extends BookingValidationError {
  override readonly code = "PHOTOS_NOT_UPLOADED";

  constructor() {
    super("One or more photos didn't finish uploading. Please try again.");
  }
}

/**
 * A photo is already attached to another booking. The code tells the
 * booking client to upload its photos again rather than resend the keys.
 */
export class PhotosInUseError extends BookingValidationError {
  override readonly code = "PHOTOS_IN_USE";

  constructor() {
    super("One or more photos are already attached to another booking. Upload them again.");
  }
}


/**
 * Phase 1 vertical slice, step 1: a customer books one pair, or a
 * three-pair Bundle, through /booking. Every Order belongs to a Customer Account (ADR-0014), resolved
 * by resolveOwner below: never an Admin Account, even for an admin's email. Every ADR-0012 concern is present: authz
 * (anyone can submit, but the check is still explicit), business rules
 * enforced server-side (Policy Acceptance, Pickup area, Service rules),
 * money computed from the server's own catalog, idempotency on the
 * submission key, and a notification on the resulting state.
 */
export async function submitOrder(deps: SubmitOrderDeps, actingUser: ActingUser, input: SubmitOrderInput): Promise<Order> {
  requireRole(actingUser, "GUEST", "CUSTOMER");

  // Affirmative acceptance of the agreement the customer saw (ADR-0015).
  if (!input.policyAccepted || !acknowledgesAll(input.acknowledgedTerms) || input.termsVersion !== TERMS_AGREEMENT.version) {
    throw new PolicyNotAcceptedError();
  }

  const now = deps.now?.() ?? new Date();

  // A retry of a submission that already went through gets its Order back
  // before any other check: its photo keys are, by design, already in use,
  // and a date that was valid then may have passed since (#76).
  const fingerprint = input.submissionKey ? submissionFingerprint(input) : null;
  if (input.submissionKey) {
    const existing = await deps.orders.findBySubmissionKey(input.submissionKey);
    if (existing) return sendConfirmationOnce(deps, await sameSubmission(deps, existing, fingerprint, now), now);
  }

  const contact = validateContact(input.contact);
  const fulfillment = validateFulfillment(input.fulfillment, now);
  const pairs = pricePairs(input);
  const orderEstimate = estimateOrder({ items: pairs.map((pair) => pair.estimate), rush: input.rush });
  const photos = await keepVerifiedPhotos(deps, input.items.map((item) => item.photoKeys));

  const newOrder = (owner: OrderOwner) =>
    deps.orders.create({
      owner,
      contactName: contact.name,
      contactEmail: contact.email,
      contactPhone: contact.phone,
      policyAcceptedAt: now,
      terms: {
        version: TERMS_AGREEMENT.version,
        url: TERMS_AGREEMENT.href,
        sha256: TERMS_AGREEMENT.sha256,
        acknowledgments: acknowledgmentRecord(input.acknowledgedTerms),
      },
      fulfillment,
      rush: input.rush,
      estimate: orderEstimate.estimate,
      estimateIsMinimum: orderEstimate.isMinimum,
      deposit: orderEstimate.deposit,
      submissionKey: input.submissionKey,
      submissionFingerprint: fingerprint,
      bundleId: input.bundleId,
      items: input.items.map((item, i) => ({
        brand: blankToNull(item.brand),
        model: null, // the booking form's single "Brand / Model" field lands in `brand`
        description: blankToNull(item.notes),
        material: pairs[i]!.material,
        serviceIds: pairs[i]!.serviceIds,
        estimate: pairs[i]!.estimate.estimate,
        photos: photos[i]!,
      })),
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
    if (err instanceof PhotoKeyInUseError) throw new PhotosInUseError();
    throw err;
  }

  // created is false when a concurrent request with the same key won.
  const order = created.created ? created.order : await sameSubmission(deps, created.order, fingerprint, now);
  return sendConfirmationOnce(deps, order, now);
}

/**
 * The existing Order for a reused submission key, if it was the same
 * booking (#76). If the details changed, the customer is refused and told
 * to check their email for the booking that went through, so that email
 * must actually go out first. A failed first send is the likeliest reason
 * they edited and retried. Best effort: the refusal stands even if the
 * send fails again, and a later retry tries once more.
 */
async function sameSubmission(deps: SubmitOrderDeps, existing: Order, fingerprint: string | null, now: Date): Promise<Order> {
  if (existing.submissionFingerprint !== null && existing.submissionFingerprint !== fingerprint) {
    await sendConfirmationOnce(deps, existing, now).catch(() => undefined);
    throw new SubmissionConflictError(existing);
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
      throw new BookingValidationError("Local Drop-Off is only available in NY, NJ and CT. Choose Mail-In instead.");
    }
    if (!isCalendarDate(fulfillment.date) || fulfillment.date < today) {
      throw new BookingValidationError("Choose a collection date from today onward.");
    }
    if (!PICKUP_TIME_SLOTS.includes(fulfillment.slot)) {
      throw new BookingValidationError("Choose a collection time between 4:30 PM and 10:00 PM.");
    }
    if (!availablePickupSlots(fulfillment.date, now).includes(fulfillment.slot)) {
      throw new BookingValidationError(
        `That collection time is no longer available. Same-day collections need at least ${PICKUP_LEAD_MINUTES / 60} hours' notice.`,
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
 * Copies each uploaded photo to a key no upload target can write to, then
 * checks the copy: it must exist, and its bytes and stored Content-Type
 * must be the image type its key promises (#77). Checking the copy, not
 * the upload, matters: an upload target stays usable for a few minutes, so
 * the upload itself could still be overwritten after any check of it. A
 * key alone proves nothing: it doesn't show the upload finished, and a
 * target's pinned Content-Type is only a label on whatever bytes were sent.
 */
/** Storage calls in flight at once while copying and checking photos. */
const STORAGE_CONCURRENCY = 10;

async function keepVerifiedPhotos(
  deps: SubmitOrderDeps,
  uploadKeysByPair: string[][],
): Promise<{ key: string; uploadKey: string }[][]> {
  const batchId = (deps.newId ?? randomUUID)();
  // One running index across the pairs, so every copy gets its own key.
  let index = 0;
  const byPair = uploadKeysByPair.map((uploadKeys) =>
    uploadKeys.map((uploadKey) => ({ key: storedPhotoKey(batchId, index++, uploadKey), uploadKey })),
  );
  const photos = byPair.flat();

  // A Bundle can carry 30 photos; bounded so the calls don't all start at once.
  const copied = await mapWithConcurrency(photos, STORAGE_CONCURRENCY, (photo) => deps.storage.copy(photo.uploadKey, photo.key));
  if (copied.includes(false)) throw new PhotosNotUploadedError();

  const stored = await mapWithConcurrency(photos, STORAGE_CONCURRENCY, (photo) => deps.storage.inspect(photo.key));
  if (stored.some((object) => object === null || object.size === 0)) throw new PhotosNotUploadedError();
  const valid = stored.every(
    (object, i) =>
      photoMatchesKey(photos[i]!.key, object!.head) && object!.contentType === photoKeyContentType(photos[i]!.key),
  );
  if (!valid) throw new BookingValidationError("One or more photos aren't valid JPEG, PNG, WebP or HEIC images.");
  return byPair;
}

function validateMaterial(material: string | null): Material | null {
  const value = blankToNull(material);
  if (value === null) return null;
  if (!(MATERIALS as readonly string[]).includes(value)) {
    throw new BookingValidationError(`Unknown material: ${value}`);
  }
  return value as Material;
}

/**
 * Each pair's material, Services and estimate, from the server's own
 * catalog. A single pair is priced from its Services; a Bundle's three pairs
 * each get the Bundle's Services and an even share of its fixed price, with
 * the Suede Fee waived (CONTEXT.md: Bundle), plus their own Add-ons.
 */
function pricePairs(input: SubmitOrderInput): { material: Material | null; serviceIds: string[]; estimate: ItemEstimate }[] {
  const pairLabel = (i: number) => (input.bundleId === null ? "your pair" : `pair ${i + 1}`);
  const materials = input.items.map((item) => validateMaterial(item.material));
  input.items.forEach((item, i) => validatePhotoKeys(item.photoKeys, pairLabel(i)));
  const allKeys = input.items.flatMap((item) => item.photoKeys);
  if (new Set(allKeys).size !== allKeys.length) throw new BookingValidationError("The same photo can't be added twice.");

  try {
    if (input.bundleId === null) {
      if (input.items.length !== 1) throw new BookingValidationError(`Book one pair, or choose a Bundle for ${BUNDLE_PAIRS}.`);
      const { serviceIds } = input.items[0]!;
      return [{ material: materials[0]!, serviceIds, estimate: estimateItem({ serviceIds, material: materials[0]! }) }];
    }
    if (input.items.length !== BUNDLE_PAIRS) {
      throw new BookingValidationError(`A Bundle covers exactly ${BUNDLE_PAIRS} pairs.`);
    }
    // Add-ons only: estimateBundleItems refuses any other Service per pair.
    const addOnIdsByPair = input.items.map((item) => item.serviceIds);
    return estimateBundleItems(input.bundleId, addOnIdsByPair).map((estimate, i) => ({
      material: materials[i]!,
      serviceIds: [...BUNDLE_PAIR_SERVICE_IDS, ...addOnIdsByPair[i]!], // each Item its own array, never the catalog's
      estimate,
    }));
  } catch (err) {
    if (err instanceof InvalidServiceSelectionError) throw new BookingValidationError(err.message);
    throw err;
  }
}

function validatePhotoKeys(photoKeys: string[], pairLabel: string) {
  if (photoKeys.length === 0) throw new BookingValidationError(`Add at least one photo of ${pairLabel}.`);
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
  const pairs = pairsPhrase(order.items.length);
  const nextStep =
    order.fulfillment.method === "PICKUP"
      ? `Local Drop-Off: DJ will collect ${pairs} on ${order.fulfillment.date}, ${order.fulfillment.slot}, and drop them back off when they're done.`
      : `Mail-In: we'll email you where to ship ${pairs}, and ship them back when they're done.`;
  const bundle = findBundle(order.bundleId);
  return [
    `Thanks, ${order.contactName}. Your booking ${reference} was received.`,
    ...(bundle
      ? [`Bundle: ${bundle.name} (${bundle.perks.join(", ")}). We'll decide which pairs get its extras once we've inspected them.`]
      : []),
    `Estimated total: ${estimate}. Deposit due: ${order.deposit.format()}.`,
    howToPay,
    nextStep,
    "We'll inspect your sneakers and confirm final pricing before any work begins.",
    // The customer's own copy of what they accepted (ADR-0015).
    ...(order.termsAcceptance
      ? [`You agreed to our ${TERMS_AGREEMENT.title} (version ${order.termsAcceptance.version}) when you booked.`]
      : []),
  ].join("\n\n");
}
