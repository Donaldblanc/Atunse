import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { clientIp, hashClient, limitByIp, RATE_LIMITS } from ".";
import { InMemoryRateLimiter } from "./in-memory-rate-limiter";
import { secondsLeftInWindow, windowStart } from "./rate-limiter";

const policy = { name: "test", limit: 3, windowSeconds: 600 };
const request = (ip: string) => new NextRequest("http://localhost/api", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });

describe("fixed-window rate limiting", () => {
  it("allows up to the limit per window, then refuses with the time left", async () => {
    const limiter = new InMemoryRateLimiter();
    const now = new Date("2026-10-01T15:02:00Z");
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await limiter.consume(policy, "client", now));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3]!.retryAfterSeconds).toBe(8 * 60); // window 15:00–15:10

    expect((await limiter.consume(policy, "client", new Date("2026-10-01T15:10:00Z"))).allowed).toBe(true);
    expect((await limiter.consume(policy, "someone-else", now)).allowed).toBe(true);
  });

  it("aligns windows to fixed boundaries", () => {
    expect(windowStart(policy, new Date("2026-10-01T15:07:59Z")).toISOString()).toBe("2026-10-01T15:00:00.000Z");
    expect(secondsLeftInWindow(policy, new Date("2026-10-01T15:09:59.500Z"))).toBe(1);
  });
});

describe("limitByIp", () => {
  it("answers 429 with Retry-After once an IP is over the limit, per IP", async () => {
    const limiter = new InMemoryRateLimiter();
    for (let i = 0; i < 3; i++) expect(await limitByIp(request("203.0.113.7"), policy, limiter)).toBeNull();
    const refused = await limitByIp(request("203.0.113.7"), policy, limiter);
    expect(refused?.status).toBe(429);
    expect(Number(refused?.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await limitByIp(request("198.51.100.2"), policy, limiter)).toBeNull();
  });

  it("uses the first X-Forwarded-For hop, and never stores the raw IP", () => {
    expect(clientIp(request("203.0.113.7"))).toBe("203.0.113.7");
    expect(hashClient("203.0.113.7", "s")).not.toContain("203.0.113.7");
    expect(hashClient("203.0.113.7", "s")).toBe(hashClient("203.0.113.7", "s"));
  });

  it("has a policy for each public route", () => {
    expect(Object.keys(RATE_LIMITS).sort()).toEqual(["codeRequest", "codeVerify", "orders", "uploads"]);
  });
});
