import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "./authz";
import { clearedSessionCookieOptions, createSessionCookieValue, sessionCookieOptions, verifySessionCookieValue } from "./session";

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret-0123456789abcdef0123456789abcdef0123456789abcdef";
});
afterEach(() => {
  vi.useRealTimers();
});

describe("verifySessionCookieValue fails closed on anything but a valid session", () => {
  it.each([
    ["missing", undefined],
    ["null", null],
    ["empty", ""],
    ["x.!!! (not base64url)", "x.!!!"],
    ["random string", "definitely-not-a-session"],
    ["three parts", "a.b.c"],
    ["one part", "abc."],
    ["percent junk", "%%%.@@@"],
    ["unicode", "ünï.cødé"],
  ])("%s -> null", async (_label, value) => {
    await expect(verifySessionCookieValue(value)).resolves.toBeNull();
  });

  it("rejects a valid token whose signature was altered", async () => {
    const token = await createSessionCookieValue("acc_1", "ADMIN");
    const [payload, signature] = token.split(".");
    const flipped = signature!.startsWith("A") ? `B${signature!.slice(1)}` : `A${signature!.slice(1)}`;
    await expect(verifySessionCookieValue(`${payload}.${flipped}`)).resolves.toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionCookieValue("acc_1", "ADMIN");
    process.env.SESSION_SECRET = "another-secret-9876543210fedcba9876543210fedcba9876543210";
    await expect(verifySessionCookieValue(token)).resolves.toBeNull();
  });

  it("rejects a tampered payload (e.g. role raised to ADMIN)", async () => {
    const token = await createSessionCookieValue("acc_1", "CUSTOMER");
    const [, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ accountId: "acc_1", role: "ADMIN", exp: Date.now() + 1e7 })).toString("base64url");
    await expect(verifySessionCookieValue(`${forged}.${signature}`)).resolves.toBeNull();
  });

  it("rejects an expired session", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-01T10:00:00Z") });
    const token = await createSessionCookieValue("acc_1", "ADMIN");
    vi.setSystemTime(new Date("2026-10-01T22:00:01Z")); // 12h + 1s later
    await expect(verifySessionCookieValue(token)).resolves.toBeNull();
  });

  it("rejects a correctly signed token with no valid role", async () => {
    const token = await createSessionCookieValue("acc_1", "GUEST" as Role);
    await expect(verifySessionCookieValue(token)).resolves.toBeNull();
  });

  it("accepts valid CUSTOMER and ADMIN sessions, with their role", async () => {
    await expect(verifySessionCookieValue(await createSessionCookieValue("acc_c", "CUSTOMER"))).resolves.toMatchObject({ role: "CUSTOMER", accountId: "acc_c" });
    await expect(verifySessionCookieValue(await createSessionCookieValue("acc_a", "ADMIN"))).resolves.toMatchObject({ role: "ADMIN", accountId: "acc_a" });
  });

  it("still throws on a misconfigured secret (not user input)", async () => {
    process.env.SESSION_SECRET = "short";
    await expect(verifySessionCookieValue("x.y")).rejects.toThrow(/SESSION_SECRET/);
  });
});

describe("session cookie attributes", () => {
  it("sets HttpOnly, SameSite=Lax, path /, and clears with the same attributes", () => {
    const set = sessionCookieOptions();
    const cleared = clearedSessionCookieOptions();
    expect(set).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 12 * 60 * 60 });
    expect(cleared).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 0, secure: set.secure });
    expect(cleared.expires.getTime()).toBe(0);
  });
});
