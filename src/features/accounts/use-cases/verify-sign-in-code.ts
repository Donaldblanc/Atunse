import { MAX_CODE_ATTEMPTS, signInCodeMatches } from "../sign-in-codes";
import type { SignInCodeDeps } from "./request-sign-in-code";

export class InvalidSignInCodeError extends Error {
  constructor(message = "That code is wrong or has expired. Request a new one.") {
    super(message);
    this.name = "InvalidSignInCodeError";
  }
}

/**
 * Checks an emailed code and returns the Customer Account it signs in
 * (ADR-0014). Only the latest code counts. Each guess is recorded before
 * comparing, so at most MAX_CODE_ATTEMPTS guesses are ever checked, even in
 * parallel, and a correct code is consumed so it can't be replayed.
 */
export async function verifySignInCode(
  deps: Pick<SignInCodeDeps, "accounts" | "codes" | "secret" | "now">,
  email: string,
  code: string,
): Promise<{ accountId: string }> {
  const account = await deps.accounts.findByEmail(email);
  if (!account || account.role !== "CUSTOMER") throw new InvalidSignInCodeError();

  const latest = await deps.codes.findLatest(account.id);
  const now = deps.now?.() ?? new Date();
  if (!latest || latest.consumedAt || latest.expiresAt <= now) throw new InvalidSignInCodeError();

  if (!(await deps.codes.recordAttempt(latest.id, MAX_CODE_ATTEMPTS))) {
    throw new InvalidSignInCodeError("Too many wrong codes. Request a new one.");
  }
  if (!signInCodeMatches(code.trim(), latest.codeHash, deps.secret)) throw new InvalidSignInCodeError();
  if (!(await deps.codes.consume(latest.id, now))) throw new InvalidSignInCodeError();

  return { accountId: account.id };
}
