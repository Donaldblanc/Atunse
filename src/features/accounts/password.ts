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

let dummyHash: Promise<string> | undefined;

/**
 * A real hash of a random password, for checking a guess against when
 * there's no account: the response then takes as long as for a real one,
 * so timing can't reveal which emails have accounts.
 */
export function passwordHashForMissingAccount(): Promise<string> {
  return (dummyHash ??= hashPassword(randomBytes(32).toString("hex")));
}
