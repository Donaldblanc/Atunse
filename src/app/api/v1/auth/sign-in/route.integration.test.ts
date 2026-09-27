// Admin sign-in abuse protection, end to end through the route handler and
// the real Postgres rate limiter. Run with `npm run test:integration`
// (against a throwaway database).

import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/features/accounts/password";
import { prisma } from "@/shared/db/prisma-client";
import { RATE_LIMITS } from "@/shared/rate-limit";
import { POST } from "./route";

const ADMIN_EMAIL = "admin-it@example.com";
const PASSWORD = "correct horse battery staple";
let ipCounter = 0;
const freshIp = () => `203.0.113.${++ipCounter % 250}`;

function signIn(email: string, password: string, ip: string) {
  return POST(
    new NextRequest("http://localhost/api/v1/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ email, password }),
    }),
  );
}

beforeAll(async () => {
  process.env.SESSION_SECRET = "test-secret-0123456789abcdef0123456789abcdef0123456789abcdef";
  await prisma.account.upsert({
    where: { email_role: { email: ADMIN_EMAIL, role: "ADMIN" } },
    update: { passwordHash: await hashPassword(PASSWORD) },
    create: { email: ADMIN_EMAIL, role: "ADMIN", passwordHash: await hashPassword(PASSWORD) },
  });
});

beforeEach(async () => {
  await prisma.rateLimitBucket.deleteMany();
});

afterAll(async () => {
  await prisma.rateLimitBucket.deleteMany();
  await prisma.account.deleteMany({ where: { email: ADMIN_EMAIL, role: "ADMIN" } });
  await prisma.$disconnect();
});

describe("POST /api/v1/auth/sign-in (integration)", () => {
  it("signs in with the right password, and sets the admin session cookie", async () => {
    const res = await signIn(ADMIN_EMAIL, PASSWORD, freshIp());
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/^atunse_session=[^;]+\./);
  });

  it("gives an unknown email exactly the same response as a wrong password", async () => {
    const wrong = await signIn(ADMIN_EMAIL, "wrong", freshIp());
    const unknown = await signIn("nobody-it@example.com", "wrong", freshIp());
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await unknown.json()).toEqual(await wrong.json());
    expect(unknown.headers.get("set-cookie")).toBeNull();
  });

  it("normalizes the email: case and surrounding spaces don't matter, for sign-in or for the limit", async () => {
    expect((await signIn("  Admin-IT@Example.COM ", PASSWORD, freshIp())).status).toBe(200);
    const variants = [" ADMIN-it@example.com", "admin-IT@EXAMPLE.com ", "Admin-It@Example.Com"];
    for (let i = 0; i < RATE_LIMITS.adminSignInAccount.limit - 1; i++) {
      expect((await signIn(variants[i % 3]!, "wrong", freshIp())).status).toBe(401);
    }
    // 1 success + 19 failures = 20 attempts on this email: the 21st is refused.
    expect((await signIn("admin-it@example.com", PASSWORD, freshIp())).status).toBe(429);
  });

  it("refuses the 11th attempt from one IP, across different emails, with an accurate Retry-After", async () => {
    const ip = freshIp();
    for (let i = 0; i < RATE_LIMITS.adminSignIn.limit; i++) {
      expect((await signIn(`guess${i}@example.com`, "wrong", ip)).status).toBe(401);
    }
    const refused = await signIn("guess-final@example.com", "wrong", ip);
    expect(refused.status).toBe(429);
    const retryAfter = Number(refused.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(RATE_LIMITS.adminSignIn.windowSeconds);
    // A different IP isn't affected.
    expect((await signIn("guess-final@example.com", "wrong", freshIp())).status).toBe(401);
  });

  it("refuses the 21st attempt on one email even when every attempt comes from a new IP", async () => {
    for (let i = 0; i < RATE_LIMITS.adminSignInAccount.limit; i++) {
      expect((await signIn("target-it@example.com", "wrong", freshIp())).status).toBe(401);
    }
    const refused = await signIn("target-it@example.com", "wrong", freshIp());
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    // Another email isn't affected.
    expect((await signIn("other-it@example.com", "wrong", freshIp())).status).toBe(401);
  });

  it("lets exactly 10 of 50 concurrent attempts from one IP through", async () => {
    const ip = freshIp();
    const statuses = await Promise.all(Array.from({ length: 50 }, (_, i) => signIn(`c${i}@example.com`, "wrong", ip).then((r) => r.status)));
    expect(statuses.filter((s) => s !== 429)).toHaveLength(RATE_LIMITS.adminSignIn.limit);
  });

  it("lets exactly 20 of 50 concurrent attempts on one email (from 50 IPs) through", async () => {
    const statuses = await Promise.all(
      Array.from({ length: 50 }, () => signIn("burst-it@example.com", "wrong", freshIp()).then((r) => r.status)),
    );
    expect(statuses.filter((s) => s !== 429)).toHaveLength(RATE_LIMITS.adminSignInAccount.limit);
  });

  it("never stores a raw email or IP as a rate-limit key", async () => {
    await signIn("stored-it@example.com", "wrong", "198.51.100.77");
    const keys = (await prisma.rateLimitBucket.findMany({ select: { key: true } })).map((r) => r.key).join(" ");
    expect(keys).not.toMatch(/example\.com|198\.51\.100\.77/);
    expect(keys).toMatch(/admin-sign-in-account:[0-9a-f]{32}/);
  });
});
