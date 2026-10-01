// What Edit Order (admin) may change on an Order, and how a change is
// described for the audit log. Pure: both repositories use diffOrderDetails
// so the real and in-memory ones record the same thing.
//
// Deliberately absent: the Fulfillment method, dates and slots (moving a
// booking is rescheduling, its own flow), money, services and status. The
// Order's contact email here is only a per-Order copy for reaching the
// customer; the Account's email is their sign-in identity (ADR-0014) and is
// never touched by this.

import type { Address, Item, Order } from "./domain";

export const PAIR_DETAIL_FIELDS = ["brand", "model", "size", "colorway", "material", "condition", "description"] as const;
export type PairDetailField = (typeof PAIR_DETAIL_FIELDS)[number];

/** The key a pair field's validation error is reported under (the form field itself is named `<itemId>:<field>`). */
export const pairFieldKey = (itemId: string, field: PairDetailField) => `pair:${itemId}:${field}`;

export const ADDRESS_FIELDS = ["line1", "line2", "city", "state", "zip"] as const;

/** Max lengths, shared by the form's maxLength and the server's validation. */
export const PAIR_DETAIL_MAX: Record<PairDetailField, number> = { brand: 80, model: 120, size: 20, colorway: 80, material: 80, condition: 80, description: 1000 };

export interface OrderDetailsInput {
  contact: { name: string; email: string; phone: string };
  address: Address;
  /** Pairs to update, by Item id; a pair left out is untouched. Empty text is already null. */
  pairs: ({ itemId: string } & Record<PairDetailField, string | null>)[];
}

export interface OrderDetailsDiff {
  /** Names of the contact and address fields that changed (never their values: customer PII stays out of the audit log). */
  contact: string[];
  pairs: { itemId: string; changes: Partial<Record<PairDetailField, { from: string | null; to: string | null }>> }[];
}

/** What `input` would change on `order`; empty (see isNoop) when it matches what's stored. */
export function diffOrderDetails(order: Order, input: OrderDetailsInput): OrderDetailsDiff {
  const contact: string[] = [];
  if (order.contactName !== input.contact.name) contact.push("contactName");
  if (order.contactEmail !== input.contact.email) contact.push("contactEmail");
  if (order.contactPhone !== input.contact.phone) contact.push("contactPhone");
  for (const field of ADDRESS_FIELDS) {
    if (order.fulfillment.address[field] !== input.address[field]) contact.push(`address.${field}`);
  }

  const pairs = input.pairs.flatMap((pair) => {
    const item: Item | undefined = order.items.find((candidate) => candidate.id === pair.itemId);
    if (!item) return [];
    const changes: OrderDetailsDiff["pairs"][number]["changes"] = {};
    for (const field of PAIR_DETAIL_FIELDS) {
      if (item[field] !== pair[field]) changes[field] = { from: item[field], to: pair[field] };
    }
    return Object.keys(changes).length > 0 ? [{ itemId: item.id, changes }] : [];
  });
  return { contact, pairs };
}

export function isNoop(diff: OrderDetailsDiff): boolean {
  return diff.contact.length === 0 && diff.pairs.length === 0;
}

/** Audit actions Edit Order writes to an Item's log (ItemAuditEntry.action). */
export const DETAILS_EDITED = "DETAILS_EDITED";
export const ORDER_CONTACT_EDITED = "ORDER_CONTACT_EDITED";
