import { createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/shared/db/prisma-client";
import { PrismaRateLimiter } from "./prisma-rate-limiter";
import type { RateLimitPolicy, RateLimiter } from "./rate-limiter";

export { RATE_LIMITS, type RateLimitPolicy, type RateLimiter } from "./rate-limiter";

/**
 * The caller's IP: Vercel sets `req.ip` (and a trustworthy first
 * X-Forwarded-For entry); locally there's none, so everyone is "local".
 */
export function clientIp(req: NextRequest): string {
  return req.ip ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "local";
}

/** A stable, non-reversible stand-in for an IP, so raw IPs are never stored. */
export function hashClient(ip: string, secret: string | undefined = process.env.SESSION_SECRET): string {
  return createHmac("sha256", secret ?? "atunse-rate-limit").update(ip).digest("hex").slice(0, 32);
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
