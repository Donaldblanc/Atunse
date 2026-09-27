import { createHmac } from "node:crypto";
import { isIPv6 } from "node:net";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/shared/db/prisma-client";
import { PrismaRateLimiter } from "./prisma-rate-limiter";
import type { RateLimitPolicy, RateLimiter } from "./rate-limiter";

export { RATE_LIMITS, type RateLimitPolicy, type RateLimiter } from "./rate-limiter";

/**
 * The caller's IP: Vercel sets `req.ip` (and a trustworthy first
 * X-Forwarded-For entry, since it overwrites that header); locally there's
 * none, so everyone is "local".
 */
export function clientIp(req: NextRequest): string {
  return req.ip ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "local";
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
 * stored. Keyed by SESSION_SECRET with no fallback: a public key would let
 * the stored hashes be reversed by brute-forcing IPv4 space.
 */
export function hashClient(ip: string, secret: string | undefined = process.env.SESSION_SECRET): string {
  if (!secret) throw new Error("SESSION_SECRET is not set — required to hash rate-limit keys");
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
  limiter: RateLimiter = (defaultLimiter ??= new PrismaRateLimiter(prisma)),
): Promise<NextResponse | null> {
  const result = await limiter.consume(policy, hashClient(clientIp(req)));
  if (result.allowed) return null;
  return NextResponse.json(
    { error: "Too many requests. Please wait a few minutes and try again." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}
