import { createHmac } from "node:crypto";
import { isIPv6 } from "node:net";
import { NextResponse, type NextRequest } from "next/server";
import { derivedSecret } from "@/shared/crypto/derived-key";
import { prisma } from "@/shared/db/prisma-client";
import { PrismaRateLimiter } from "./prisma-rate-limiter";
import type { RateLimitPolicy, RateLimiter } from "./rate-limiter";

export { RATE_LIMITS, type RateLimitPolicy, type RateLimiter } from "./rate-limiter";

/**
 * The caller's IP from X-Forwarded-For, which Vercel overwrites with the
 * real client address so it can't be spoofed (Next 15 removed `req.ip`,
 * which read the same value). Locally there's none, so everyone is "local".
 */
export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/**
 * The unit a limit applies to. An IPv6 client typically controls a whole
 * /64, so it's limited as its /64 network, not per address; an IPv4 (or
 * IPv4-mapped IPv6) address stands for itself.
 */
export function rateLimitSubject(ip: string): string {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return mapped[1]!;
  if (!isIPv6(ip)) return ip;
  const [head, tail] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const groups = tail === undefined ? left : [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/**
 * A stable, non-reversible stand-in for a client, so raw IPs are never
 * stored. Keyed by the rate-limit key derived from SESSION_SECRET, with no
 * fallback: a public key would let the stored hashes be reversed by
 * brute-forcing IPv4 space. `secret` is for tests.
 */
export function hashClient(ip: string, secret: string = derivedSecret("rate-limit")): string {
  if (!secret) throw new Error("A secret is required to hash rate-limit keys");
  return createHmac("sha256", secret).update(rateLimitSubject(ip)).digest("hex").slice(0, 32);
}

let defaultLimiter: RateLimiter | undefined;

/**
 * Counts the request against `policy` for the caller's IP. Returns a 429
 * response (with Retry-After) to send back when over the limit, otherwise
 * null, and the route carries on.
 */
export async function limitByIp(
  req: NextRequest,
  policy: RateLimitPolicy,
  limiter: RateLimiter = defaultRateLimiter(),
): Promise<NextResponse | null> {
  return tooMany(await limiter.consume(policy, hashClient(clientIp(req))));
}

/**
 * Counts the request against `policy` for any subject other than an IP,
 * e.g. an email being signed in to. The key is hashed like an IP, so it's
 * never stored as given. Returns a 429 response when over the limit.
 */
export async function limitByKey(
  policy: RateLimitPolicy,
  key: string,
  limiter: RateLimiter = defaultRateLimiter(),
): Promise<NextResponse | null> {
  return tooMany(await limiter.consume(policy, hashClient(`key:${key}`)));
}

function defaultRateLimiter(): RateLimiter {
  return (defaultLimiter ??= new PrismaRateLimiter(prisma));
}

function tooMany(result: { allowed: boolean; retryAfterSeconds: number }): NextResponse | null {
  if (result.allowed) return null;
  return NextResponse.json(
    { error: "Too many requests. Please wait a few minutes and try again." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}
