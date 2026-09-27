import type { SignInCodeDeps } from "./request-sign-in-code";

export class InvalidSignInCodeError extends Error {
  constructor(message = "That code is wrong or has expired. Request a new one.") {
    super(message);
    this.name = "InvalidSignInCodeError";
  }
}

/**
 * Checks an emailed code and returns the Customer Account it signs in
 * (ADR-0014). The guessing limits and single use are enforced by
 * SignInCodes.redeem.
 */
export async function verifySignInCode(
  deps: Pick<SignInCodeDeps, "accounts" | "codes" | "now">,
  email: string,
  code: string,
): Promise<{ accountId: string }> {
  const account = await deps.accounts.findCustomerByEmail(email);
  if (!account) throw new InvalidSignInCodeError();

  const result = await deps.codes.redeem(account.id, code.trim(), deps.now?.() ?? new Date());
  if (result === "locked") throw new InvalidSignInCodeError("Too many wrong codes. Try again later.");
  if (result === "invalid") throw new InvalidSignInCodeError();
  return { accountId: account.id };
}
