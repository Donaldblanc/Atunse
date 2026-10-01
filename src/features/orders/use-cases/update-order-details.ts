import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { isValidEmail, isValidUsPhone, isValidZip } from "../contact-rules";
import { PAIR_DETAIL_FIELDS, PAIR_DETAIL_MAX, pairFieldKey, type OrderDetailsInput, type PairDetailField } from "../order-details";
import type { FulfillmentMethod } from "../domain";
import { PICKUP_STATES, US_STATES } from "../pickup-window";
import { OrderNotFoundError, type OrderRepository } from "../repositories/order-repository";

/** What the Edit Order form posts: raw text, validated and cleaned here. */
export interface RawOrderDetails {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  pairs: ({ itemId: string } & Record<PairDetailField, string>)[];
}

/** Field name -> message. Contact and address fields use their own names; a pair's are `pair:<itemId>:<field>`. */
export type OrderDetailsErrors = Record<string, string>;

/**
 * Trims and checks the form, or says what's wrong with each field. The
 * contact rules are the booking's (contact-rules.ts), and so are the state
 * rules for the Order's fulfillment method (submitOrder: Local Drop-Off only
 * where DJ collects, Mail-In anywhere in the US), so an admin can't save
 * what the customer couldn't have submitted. Pair details are free text with
 * a max length; blank means "not known" and is stored as null.
 */
export function cleanOrderDetails(raw: RawOrderDetails, method: FulfillmentMethod): { ok: true; details: OrderDetailsInput } | { ok: false; errors: OrderDetailsErrors } {
  const errors: OrderDetailsErrors = {};
  const name = raw.contactName.trim();
  const email = raw.contactEmail.trim();
  const phone = raw.contactPhone.trim();
  const line1 = raw.line1.trim();
  const line2 = raw.line2.trim();
  const city = raw.city.trim();
  const state = raw.state.trim().toUpperCase();
  const zip = raw.zip.trim();

  if (!name) errors.contactName = "Enter the customer's name.";
  else if (name.length > 120) errors.contactName = "Keep the name under 120 characters.";
  if (!isValidEmail(email) || email.length > 254) errors.contactEmail = "Enter a valid email address.";
  if (!isValidUsPhone(phone)) errors.contactPhone = "Enter a 10-digit US phone number.";
  if (!line1) errors.line1 = "Enter the street address.";
  else if (line1.length > 120) errors.line1 = "Keep this under 120 characters.";
  if (line2.length > 120) errors.line2 = "Keep this under 120 characters.";
  if (!city) errors.city = "Enter the city.";
  else if (city.length > 80) errors.city = "Keep this under 80 characters.";
  if (method === "PICKUP" && !(PICKUP_STATES as readonly string[]).includes(state)) errors.state = "Local Drop-Off is only in NY, NJ and CT.";
  else if (!(US_STATES as readonly string[]).includes(state)) errors.state = "Use the 2-letter US state, like NY.";
  if (!isValidZip(zip)) errors.zip = "Enter a 5-digit zip code.";

  const pairs = raw.pairs.map((pair) => {
    const cleaned = { itemId: pair.itemId } as OrderDetailsInput["pairs"][number];
    for (const field of PAIR_DETAIL_FIELDS) {
      const value = pair[field].trim();
      if (value.length > PAIR_DETAIL_MAX[field]) errors[pairFieldKey(pair.itemId, field)] = `Keep this under ${PAIR_DETAIL_MAX[field]} characters.`;
      cleaned[field] = value === "" ? null : value;
    }
    return cleaned;
  });

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, details: { contact: { name, email, phone }, address: { line1, line2: line2 || null, city, state, zip }, pairs } };
}

/**
 * Edit Order (Order detail): the customer's contact and address and each
 * pair's details, saved together in one repository transaction. Admin-only
 * (ADR-0012).
 *
 * `expectedUpdatedAt` is the Order's updatedAt when the form was rendered;
 * if the Order has changed since, the repository refuses with
 * OrderChangedError rather than overwrite the other edit. The
 * idempotency key (made when the form rendered) makes a double submit or
 * retry apply once and return "already-applied". Every change is written to
 * the audit log with the actor (see updateOrderDetails on the repository).
 *
 * The contact email saved here is the Order's own copy; the Account's email
 * (the customer's sign-in, ADR-0014) is a separate thing and is not changed.
 */
export async function updateOrderDetails(
  deps: { orders: Pick<OrderRepository, "findById" | "updateOrderDetails"> },
  actingUser: ActingUser,
  input: { orderId: string; expectedUpdatedAt: Date; raw: RawOrderDetails; idempotencyKey: string },
): Promise<{ ok: true; outcome: "updated" | "unchanged" | "already-applied" } | { ok: false; errors: OrderDetailsErrors }> {
  requireRole(actingUser, "ADMIN");
  // Edit Order can't change the fulfillment method, so the one read here is the one the save keeps.
  const order = await deps.orders.findById(input.orderId);
  if (!order) throw new OrderNotFoundError(input.orderId);
  const cleaned = cleanOrderDetails(input.raw, order.fulfillment.method);
  if (!cleaned.ok) return cleaned;
  const outcome = await deps.orders.updateOrderDetails({
    orderId: input.orderId,
    expectedUpdatedAt: input.expectedUpdatedAt,
    details: cleaned.details,
    actorAccountId: actingUser.accountId,
    idempotencyKey: input.idempotencyKey,
  });
  return { ok: true, outcome };
}
