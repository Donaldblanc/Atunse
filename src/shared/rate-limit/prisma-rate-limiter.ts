import type { PrismaClient } from "@prisma/client";
import { secondsLeftInWindow, windowStart, type RateLimitPolicy, type RateLimiter, type RateLimitResult } from "./rate-limiter";

/** Windows older than this are pruned. The longest policy window is 15 minutes. */
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

export class PrismaRateLimiter implements RateLimiter {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly random: () => number = Math.random,
  ) {}

  async consume(policy: RateLimitPolicy, client: string, now: Date = new Date()): Promise<RateLimitResult> {
    const key = `${policy.name}:${client}`;
    const start = windowStart(policy, now);
    // One atomic statement: concurrent requests can't both slip under the limit.
    const [row] = await this.prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "rate_limit_buckets" ("key", "windowStart", "count")
      VALUES (${key}, ${start}, 1)
      ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "rate_limit_buckets"."count" + 1
      RETURNING "count"`;

    // Keep the table small without a cron job: about 1 request in 100 prunes.
    if (this.random() < 0.01) {
      await this.prisma.rateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - PRUNE_AFTER_MS) } } });
    }

    return { allowed: Number(row!.count) <= policy.limit, retryAfterSeconds: secondsLeftInWindow(policy, now) };
  }
}
