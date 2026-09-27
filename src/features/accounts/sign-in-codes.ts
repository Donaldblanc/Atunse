import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

// Email sign-in codes (ADR-0014): 6 digits, single use, short-lived, and
// locked after a few wrong guesses. Only an HMAC of the code is stored, so
// a database leak doesn't hand out live codes.

export const SIGN_IN_CODE_TTL_MINUTES = 10;
export const MAX_CODE_ATTEMPTS = 5;
/** Codes a single account can request per window, to stop email bombing. */
export const MAX_CODES_PER_WINDOW = 5;
export const CODE_REQUEST_WINDOW_MINUTES = 15;

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
