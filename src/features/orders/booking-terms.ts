// CONTEXT.md: Policy Acceptance. The booking Review step's two parts:
// - Pricing & Restoration Acknowledgments: risk acknowledgments, one
//   required checkbox each. They record that the customer understood each
//   risk; none of them is acceptance of the contract on its own.
// - Terms Agreement: the one checkbox that accepts the contract, the
//   Terms of Service & Restoration Agreement (TERMS_AGREEMENT, a PDF), and
//   acknowledges the risks above.
// Shared by the booking flow (which shows them) and submitOrder (which
// refuses a booking without every acknowledgment and the agreement), so
// the list can't drift between the two. Changing the wording is a policy
// change: keep an id only while its meaning stays the same.

export interface BookingAcknowledgment {
  id: string;
  /** The first sentence, shown in bold. */
  lead: string;
  detail: string;
}

export const BOOKING_ACKNOWLEDGMENTS: readonly BookingAcknowledgment[] = [
  {
    id: "pricing-after-inspection",
    lead: "Final pricing is determined after inspection.",
    detail:
      "I understand that severe wear, damage, specialty materials, or additional restoration needs may result in additional charges, which require my approval before additional work is performed.",
  },
  {
    id: "results-may-vary",
    lead: "Restoration results may vary.",
    detail:
      "I understand that stains, discoloration, oxidation, yellowing, odors, scratches, creases, or other defects may not be completely removed or corrected, and some conditions may return over time.",
  },
  {
    id: "inherent-material-risks",
    lead: "Restoration involves inherent material risks.",
    detail:
      "I understand that cleaning or restoration may reveal or worsen pre-existing deterioration, including sole separation, cracking, peeling, fading, dye bleeding, discoloration, adhesive failure, or changes to sensitive materials such as suede, nubuck, leather, mesh, or aged materials.",
  },
  {
    id: "no-structural-guarantee",
    lead: "Restoration does not guarantee structural or performance restoration.",
    detail:
      "I understand that restored footwear may still contain deterioration caused by age, wear, manufacturing defects, previous repairs, or material degradation and may not be suitable for athletic or strenuous use.",
  },
];

/** True when every current acknowledgment is among `ids`. */
export function acknowledgesAll(ids: readonly string[]): boolean {
  return BOOKING_ACKNOWLEDGMENTS.every((ack) => ids.includes(ack.id));
}
