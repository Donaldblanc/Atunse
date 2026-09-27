import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

// Email sign-in codes (ADR-0014): 6 digits, single use, short-lived. Only
// an HMAC of each code is stored, so a database leak doesn't hand out live
// codes. The whole lifecycle (issue, rate limits, guessing limits, redeem)
// lives behind the SignInCodes seam below; use-cases only ask it to issue
// or redeem.

export const SIGN_IN_CODE_TTL_MINUTES = 10;
/** Wrong guesses allowed per code. */
export const MAX_CODE_ATTEMPTS = 5;
/** Codes a single account can be sent per window, to stop email bombing. */
export const MAX_CODES_PER_WINDOW = 5;
export const CODE_REQUEST_WINDOW_MINUTES = 15;
/**
 * Guesses allowed per account over any 24 hours, across all its codes.
 * Without it the per-window limits reset every 15 minutes (5 codes × 5
 * guesses, about 2,400 guesses a day); with it, at most 20 a day.
 */
export const MAX_GUESSES_PER_DAY = 20;

export type IssueResult = { code: string } | { rateLimited: true };
export type RedeemResult = "ok" | "invalid" | "locked";

export interface SignInCodes {
  /**
   * Creates a new code for the account, retiring any earlier one (only
   * the latest code counts). Returns `rateLimited` instead, sending
   * nothing, when the account has had too many codes or guesses lately.
   */
  issue(accountId: string, now: Date): Promise<IssueResult>;
  /**
   * Counts one guess against the account's latest code, then signs in if
   * it matches and hasn't expired or been used. `locked` means too many
   * guesses (on this code, or for the account today).
   */
  redeem(accountId: string, code: string, now: Date): Promise<RedeemResult>;
}

export function generateSignInCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashSignInCode(code: string, secret: string): string {
  return createHmac("sha256", secret).update(`sign-in-code:${code}`).digest("hex");
}

export function signInCodeMatches(code: string, codeHash: string, secret: string): boolean {
  const given = Buffer.from(hashSignInCode(code, secret), "hex");
  const stored = Buffer.from(codeHash, "hex");
  return given.length === stored.length && timingSafeEqual(given, stored);
}

export function minutesBefore(now: Date, minutes: number): Date {
  return new Date(now.getTime() - minutes * 60_000);
}
