import type { Role } from "./authz";

// Minimal signed-cookie session — an interim stand-in for whatever a
// managed auth provider issues (ADR-0005 addendum). Payload is small and
// server-verified on every request; nothing here is trusted from the
// client without checking the signature.
//
// Uses Web Crypto (globalThis.crypto.subtle) rather than node:crypto
// because this is imported from src/middleware.ts, which runs on Next's
// Edge runtime — node:crypto isn't available there, but Web Crypto is
// available in both Edge and Node 18+.

export const SESSION_COOKIE_NAME = "atunse_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export interface SessionPayload {
  accountId: string;
  role: Role;
  exp: number; // epoch ms
}

function encoder() {
  return new TextEncoder();
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set — required to sign/verify admin sessions");
  }
  return crypto.subtle.importKey("raw", encoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
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

  const key = await hmacKey();
  const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), encoder().encode(encoded));
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
