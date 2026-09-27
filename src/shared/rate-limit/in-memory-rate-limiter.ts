import { secondsLeftInWindow, windowStart, type RateLimitPolicy, type RateLimiter, type RateLimitResult } from "./rate-limiter";

/** Test double: the same fixed-window counting, in a Map. */
export class InMemoryRateLimiter implements RateLimiter {
  readonly counts = new Map<string, number>();

  async consume(policy: RateLimitPolicy, client: string, now: Date = new Date()): Promise<RateLimitResult> {
    const key = `${policy.name}:${client}:${windowStart(policy, now).getTime()}`;
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return { allowed: count <= policy.limit, retryAfterSeconds: secondsLeftInWindow(policy, now) };
  }
}
