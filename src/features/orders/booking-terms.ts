// CONTEXT.md: Policy Acceptance. What the customer acknowledges at the
// final review step, one required checkbox each, before also agreeing to
// the Terms of Service, Refund Policy, Restoration Disclaimer and Payment
// Policy. Shared by the booking flow (which shows them) and submitOrder
// (which refuses a booking that didn't acknowledge every one), so the
// list can't drift between the two. Changing the wording is a policy
// change: keep an id only while its meaning stays the same.

export const BOOKING_ACKNOWLEDGEMENTS = [
  { id: "final-pricing", text: "Final pricing is determined after inspection." },
  { id: "additional-charges", text: "Severe wear, damage, or specialty materials may incur additional charges." },
  { id: "results-vary", text: "Results may vary. Re-yellowing can occur over time due to oxidation." },
  {
    id: "no-structural-guarantee",
    text: "Services improve appearance and feel but do not guarantee structural or performance restoration.",
  },
] as const;

export type AcknowledgementId = (typeof BOOKING_ACKNOWLEDGEMENTS)[number]["id"];

/** True when every current acknowledgement is among `ids`. */
export function acknowledgesAll(ids: readonly string[]): boolean {
  return BOOKING_ACKNOWLEDGEMENTS.every((ack) => ids.includes(ack.id));
}
