import { keyLabel, requireSessionSecret } from "@/shared/crypto/derived-key";
import type { Role } from "./authz";

// Minimal signed-cookie session — an interim stand-in for whatever a
// managed auth provider issues (ADR-0005 addendum). Payload is small and
// server-verified on every request; nothing here is trusted from the
// client without checking the signature.
//
// Uses Web Crypto (globalThis.crypto.subtle) rather than node:crypto so it
// runs on any runtime: src/proxy.ts (Node.js since Next 16; middleware ran
// on the Edge runtime before) and the route handlers.

/** The admin session (password login). Only ever carries role ADMIN. */
export const SESSION_COOKIE_NAME = "atunse_session";
/**
 * The customer session (email-code login), a separate cookie so admin and
 * customer logins never mix (ADR-0014): an admin browsing the booking flow
 * is a signed-out customer there. Only ever carries role CUSTOMER.
 */
export const CUSTOMER_SESSION_COOKIE_NAME = "atunse_customer_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export interface SessionPayload {
  accountId: string;
  role: Role;
  exp: number; // epoch ms
}

function encoder() {
  return new TextEncoder();
}

/**
 * The session signing key: HMAC-SHA256(SESSION_SECRET, "atunse:session"),
 * the same derivation as derivedSecret("session") in
 * shared/crypto/derived-key.ts, done with Web Crypto so this file stays
 * runtime-agnostic.
 */
async function hmacKey(): Promise<CryptoKey> {
  const secret = requireSessionSecret();
  const master = await crypto.subtle.importKey("raw", encoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const derived = await crypto.subtle.sign("HMAC", master, encoder().encode(keyLabel("session")));
  return crypto.subtle.importKey("raw", derived, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of buf) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function createSessionCookieValue(accountId: string, role: Role): Promise<string> {
  const payload: SessionPayload = { accountId, role, exp: Date.now() + SESSION_TTL_MS };
  const encoded = toBase64Url(encoder().encode(JSON.stringify(payload)));
  const key = await hmacKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder().encode(encoded));
  return `${encoded}.${toBase64Url(signature)}`;
}

export async function verifySessionCookieValue(
  value: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!value) return null;

  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;

  // A malformed signature (not base64url) is just an invalid cookie: treat
  // it as signed out, not as a server error (vulnerability scan).
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = fromBase64Url(signature);
  } catch {
    return null;
  }

  const key = await hmacKey();
  const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, encoder().encode(encoded));
  if (!valid) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
  } catch {
    return null;
  }

  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  if (typeof payload.accountId !== "string" || typeof payload.role !== "string") return null;

  return payload;
}

export const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;
