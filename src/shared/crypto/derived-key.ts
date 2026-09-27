import { createHmac } from "node:crypto";

// One SESSION_SECRET, a separate key per use (vulnerability scan). Each
// purpose gets HMAC-SHA256(SESSION_SECRET, "atunse:<purpose>"), so a value
// signed for one use (a session, an upload link, a sign-in code hash, a
// rate-limit key) can never be valid for another, and a leak in one
// doesn't expose the others.

export type KeyPurpose = "session" | "sign-in-code" | "rate-limit" | "local-upload";

/** Shorter secrets are refused: they're guessable, and every key derives from this one. */
export const MIN_SECRET_LENGTH = 32;

export class WeakSecretError extends Error {}

/** SESSION_SECRET, or a clear error when it's missing or too short. */
export function requireSessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.SESSION_SECRET;
  if (!secret) throw new WeakSecretError("SESSION_SECRET is not set — generate one with `openssl rand -hex 32`");
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new WeakSecretError(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters (openssl rand -hex 32)`);
  }
  return secret;
}

/** The label the key for `purpose` is derived from. Shared with the Web Crypto version in session.ts. */
export function keyLabel(purpose: KeyPurpose): string {
  return `atunse:${purpose}`;
}

/** The key for one purpose, as hex (Node runtime). */
export function derivedSecret(purpose: KeyPurpose, env: NodeJS.ProcessEnv = process.env): string {
  return createHmac("sha256", requireSessionSecret(env)).update(keyLabel(purpose)).digest("hex");
}
