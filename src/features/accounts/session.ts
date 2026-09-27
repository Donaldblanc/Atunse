import { derivedKeyBytes } from "@/shared/crypto/derived-key";
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
 * The session signing key: HKDF-derived from SESSION_SECRET for the
 * "atunse/session/v1" purpose (shared/crypto/derived-key.ts), via Web
 * Crypto so this file stays runtime-agnostic.
 */
async function hmacKey(): Promise<CryptoKey> {
  const derived = await derivedKeyBytes("session");
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

/**
 * The session a cookie value carries, or null. Fails closed: a missing,
 * empty, malformed (wrong shape, not base64url, not JSON), wrongly signed,
 * expired or structurally invalid value is simply "signed out", never an
 * exception, so user-controlled cookies can't cause a 500. A missing or
 * weak SESSION_SECRET still throws: that's misconfiguration, not input.
 */
export async function verifySessionCookieValue(
  value: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [encoded, signature] = parts as [string, string];

  const key = await hmacKey();
  try {
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), encoder().encode(encoded));
    if (!valid) return null;

    const payload: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
    return isSessionPayload(payload) && payload.exp >= Date.now() ? payload : null;
  } catch {
    return null; // not base64url, or not JSON
  }
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.accountId === "string" &&
    v.accountId.length > 0 &&
    (v.role === "ADMIN" || v.role === "CUSTOMER") &&
    typeof v.exp === "number" &&
    Number.isFinite(v.exp)
  );
}

export const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;

/**
 * The attributes both session cookies are set with. Signing out clears a
 * cookie with the same attributes (and Max-Age 0), so the browser matches
 * and drops exactly that cookie.
 */
export function sessionCookieOptions(maxAgeSeconds: number = SESSION_COOKIE_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Options that expire a session cookie immediately (sign-out). */
export function clearedSessionCookieOptions() {
  return { ...sessionCookieOptions(0), expires: new Date(0) };
}
