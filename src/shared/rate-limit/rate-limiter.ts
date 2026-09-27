// Per-client rate limits for the public routes (#77). The seam: routes use
// limitByIp (./index.ts); the counters live behind RateLimiter, in Postgres
// in the app (serverless instances share no memory) and in memory in tests.

export interface RateLimitPolicy {
  /** Distinguishes the counters of different routes. */
  name: string;
  /** Requests allowed per window. */
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the current window ends (for Retry-After). */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  /** Counts one request by `client` against `policy`. */
  consume(policy: RateLimitPolicy, client: string, now?: Date): Promise<RateLimitResult>;
}

/** The fixed window an instant falls in. */
export function windowStart(policy: RateLimitPolicy, now: Date): Date {
  const windowMs = policy.windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export function secondsLeftInWindow(policy: RateLimitPolicy, now: Date): number {
  const end = windowStart(policy, now).getTime() + policy.windowSeconds * 1000;
  return Math.max(1, Math.ceil((end - now.getTime()) / 1000));
}

/**
 * Per-IP limits, generous for a real customer and tight for a script. The
 * per-account sign-in limits (ADR-0014) still apply on top.
 */
export const RATE_LIMITS = {
  /**
   * Upload targets: one request per pair per booking attempt (up to 10
   * photos each). A Bundle is 3 pairs (BUNDLE_PAIRS), so this allows ~20
   * Bundle attempts, the same as ~20 single-pair ones. A test in
   * features/orders keeps it in step with BUNDLE_PAIRS.
   */
  uploads: { name: "uploads", limit: 60, windowSeconds: 10 * 60 },
  /** Booking submissions, including retries. */
  orders: { name: "orders", limit: 10, windowSeconds: 10 * 60 },
  /** Sign-in code emails, across all emails a caller tries. */
  codeRequest: { name: "code-request", limit: 10, windowSeconds: 15 * 60 },
  /** Sign-in code guesses, across all emails a caller tries. */
  codeVerify: { name: "code-verify", limit: 20, windowSeconds: 15 * 60 },
} satisfies Record<string, RateLimitPolicy>;
