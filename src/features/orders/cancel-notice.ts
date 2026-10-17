// How a customer cancels a booking or closes their account: by emailing
// the shop (there's no self-serve cancel). Shared by the booking pages
// (which render the link) and the confirmation email (plain text).

export const CANCEL_PROMPT = "Need to cancel your booking or close your account?";

/** Plain-text line for emails. Without a configured inbox, customers reply to the email. */
export function cancelEmailLine(inbox: string | null): string {
  return inbox ? `${CANCEL_PROMPT} Email us at ${inbox}.` : `${CANCEL_PROMPT} Reply to this email.`;
}
