import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// scrypt via Node's built-in crypto — no external dependency needed for the
// interim in-house credential store (ADR-0005 addendum). Swap for whatever
// a managed auth provider does internally once one is chosen; callers only
// see hashPassword/verifyPassword.
//
// Async on purpose: scrypt costs real CPU per call, and the sync version
// would block every other request while a guess is checked.

const KEY_LENGTH = 64;

/** Current cost: N=2^17, r=8, p=1 (~128 MiB per check; maxmem leaves headroom). */
const SCRYPT = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 } as const;

type ScryptParams = { N: number; r: number; p: number; maxmem?: number };
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
  options?: ScryptParams,
) => Promise<Buffer>;

// Stored as `scrypt$N$r$p$saltHex$hashHex`, so the cost can rise later
// without breaking old hashes. The legacy `saltHex:hashHex` form (Node's
// default N=2^14, r=8, p=1) still verifies and is rehashed on admin sign-in.
const CURRENT_FORMAT = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([0-9a-f]+)\$([0-9a-f]+)$/;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Seam for the timing equaliser below, so a test can see it run without
 * asserting wall-clock time.
 */
export const passwordInternals = {
  /** One throwaway derivation at the current cost (N=2^17). */
  async burnCurrentCost(password: string): Promise<void> {
    try {
      await scryptAsync(password, Buffer.alloc(16), KEY_LENGTH, SCRYPT);
    } catch {
      // only the time spent matters
    }
  },
};

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const current = CURRENT_FORMAT.exec(storedHash);
  let salt: Buffer;
  let expected: Buffer;
  let options: ScryptParams | undefined;
  if (current) {
    const [, n, r, p, saltHex, hashHex] = current as unknown as [string, string, string, string, string, string];
    options = { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem };
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } else {
    const [saltHex, hashHex, ...rest] = storedHash.split(":");
    if (!saltHex || !hashHex || rest.length > 0) return false;
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  }
  if (expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = await scryptAsync(password, salt, expected.length, options);
  } catch {
    return false; // unusable stored params (e.g. beyond maxmem)
  }
  const matches = actual.length === expected.length && timingSafeEqual(actual, expected);
  // A legacy hash verifies ~7x faster than the N=2^17 dummy used for unknown
  // accounts, so a wrong guess would reveal that the account exists. Pad the
  // failure up to one current-cost derivation. (A right guess rehashes anyway.)
  if (!matches && !current) await passwordInternals.burnCurrentCost(password);
  return matches;
}

/**
 * True when the stored hash is legacy or weaker than the current cost, so a
 * successful login should rehash it. A stronger hash is never downgraded.
 */
export function passwordNeedsRehash(storedHash: string): boolean {
  const current = CURRENT_FORMAT.exec(storedHash);
  if (!current) return true;
  const [n, r, p] = [Number(current[1]), Number(current[2]), Number(current[3])];
  if (n !== SCRYPT.N) return n < SCRYPT.N;
  return r < SCRYPT.r || p < SCRYPT.p;
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
export const MISSING_ACCOUNT_PASSWORD_HASH = "scrypt$131072$8$1$aa384e6ed5d548754af8929be9bbc0c3$f084a25d9c0600231d5427757077d98544e5772ad6e882634ecb93db7ee69747712f9d9f9d8fed6fe72d3599680023b4564e01cb543a7a4088c76c36b53bce06";
