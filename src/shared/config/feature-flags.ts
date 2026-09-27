// Feature toggles are env/config only, never an owner-facing admin control
// (docs/SPEC.md). Only the literal "true" turns one on, so a blank, missing
// or misspelled value keeps the feature off.

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

/**
 * Customer email-code login (ADR-0014). Off: bookings with an existing
 * email attach to that Account, the code routes answer 404, and customers
 * can't view photos. Turn on once real email delivery (Resend) is live,
 * since codes are useless if they can't reach the customer.
 */
export function isCustomerSignInEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isEnabled(env.FEATURE_CUSTOMER_SIGN_IN_ENABLED);
}
