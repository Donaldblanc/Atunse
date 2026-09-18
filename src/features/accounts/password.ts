import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// scrypt via Node's built-in crypto — no external dependency needed for the
// interim in-house credential store (ADR-0005 addendum). Swap for whatever
// a managed auth provider does internally once one is chosen; callers only
// see hashPassword/verifyPassword.

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [saltHex, hashHex] = storedHash.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
