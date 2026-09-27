import { hkdfSync } from "node:crypto";

// SESSION_SECRET is master key material, never used as a key itself. Each
// use gets its own key, derived with HKDF-SHA256 (RFC 5869) under an
// explicit, versioned label ("atunse/<purpose>/v<version>"). A value signed
// for one use (a session, an upload link, a sign-in code hash, a rate-limit
// key) can never be valid for another, and a leak of one key doesn't expose
// the others. Bumping a purpose's version (e.g. to rotate just that key)
// needs no API change.

export const KEY_PURPOSES = ["session", "sign-in-code", "rate-limit", "local-upload"] as const;
export type KeyPurpose = (typeof KEY_PURPOSES)[number];

/** The version every purpose uses today. */
export const CURRENT_KEY_VERSION = 1;

/** Derived key length in bytes (HMAC-SHA256 keys). */
export const DERIVED_KEY_BYTES = 32;

/** Fixed, public HKDF salt: domain separation only; the secret supplies the entropy. */
export const HKDF_SALT = "atunse-key-derivation";

/** Shorter secrets are refused: they're guessable, and every key derives from this one. */
export const MIN_SECRET_LENGTH = 32;
/** Refuses placeholders like "aaaa…" or "changeme-changeme…" that pass the length check. */
const MIN_DISTINCT_CHARACTERS = 10;

export class WeakSecretError extends Error {}

/** SESSION_SECRET, or a clear error when it's missing or too weak (fail fast). */
export function requireSessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.SESSION_SECRET;
  if (!secret) throw new WeakSecretError("SESSION_SECRET is not set — generate one with `openssl rand -hex 32`");
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new WeakSecretError(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters (openssl rand -hex 32)`);
  }
  if (new Set(secret).size < MIN_DISTINCT_CHARACTERS) {
    throw new WeakSecretError("SESSION_SECRET looks like a placeholder; generate a random one with `openssl rand -hex 32`");
  }
  return secret;
}

/** The HKDF `info` label for a purpose and version, e.g. "atunse/session/v1". */
export function keyLabel(purpose: KeyPurpose, version: number = CURRENT_KEY_VERSION): string {
  if (!Number.isInteger(version) || version < 1) throw new Error(`Invalid key version: ${version}`);
  return `atunse/${purpose}/v${version}`;
}

/** The key for one purpose and version, as hex (Node runtime). */
export function derivedSecret(
  purpose: KeyPurpose,
  env: NodeJS.ProcessEnv = process.env,
  version: number = CURRENT_KEY_VERSION,
): string {
  const key = hkdfSync("sha256", requireSessionSecret(env), HKDF_SALT, keyLabel(purpose, version), DERIVED_KEY_BYTES);
  return Buffer.from(key).toString("hex");
}

/**
 * The same derivation with Web Crypto, for code that must stay
 * runtime-agnostic (session.ts). Returns the raw key bytes.
 */
export async function derivedKeyBytes(
  purpose: KeyPurpose,
  env: NodeJS.ProcessEnv = process.env,
  version: number = CURRENT_KEY_VERSION,
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const master = await crypto.subtle.importKey("raw", encoder.encode(requireSessionSecret(env)), "HKDF", false, ["deriveBits"]);
  return crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: encoder.encode(HKDF_SALT), info: encoder.encode(keyLabel(purpose, version)) },
    master,
    DERIVED_KEY_BYTES * 8,
  );
}
