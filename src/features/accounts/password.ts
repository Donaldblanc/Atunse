import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// scrypt via Node's built-in crypto — no external dependency needed for the
// interim in-house credential store (ADR-0005 addendum). Swap for whatever
// a managed auth provider does internally once one is chosen; callers only
// see hashPassword/verifyPassword.
//
// Async on purpose: scrypt costs ~30 ms of CPU per call, and the sync
// version would block every other request while a guess is checked.

const KEY_LENGTH = 64;
const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keyLength: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, hashHex] = storedHash.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, salt, expected.length);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * A fixed, valid scrypt hash (same format and cost as hashPassword's) of a
 * random password that was discarded when it was generated, so nothing
 * matches it. A guess against an account that doesn't exist (or has no
 * password) is checked against this, so the response takes as long as for
 * a real account and timing can't reveal which emails have accounts. It's
 * a constant rather than computed at startup, so even the first such
 * request costs exactly one scrypt check.
 */
export const MISSING_ACCOUNT_PASSWORD_HASH =
  "2704814b8407d12f104f9250020e2169:262bac69abd092bd552065f8399799fda1b4ea4fda070dc4cc18f877326e4aef80b43e612f362b07220cc8a06a6219b9717a5311a9bcdf9c90f8618c964d7195";
