import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { checkAdminAccess } from "./admin-check";
import { SESSION_COOKIE_NAME, createSessionCookieValue } from "./session";

function req(path: string, cookie?: string): NextRequest {
  const headers = cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : undefined;
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

describe("checkAdminAccess", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret";
  });

  it("fails closed with no session cookie", async () => {
    const result = await checkAdminAccess(req("/admin"));
    expect(result.allowed).toBe(false);
    expect(result.role).not.toBe("ADMIN");
  });

  it("never grants access regardless of the requested path, absent a session", async () => {
    expect((await checkAdminAccess(req("/admin/orders"))).allowed).toBe(false);
    expect((await checkAdminAccess(req("/api/v1/admin/items/123/transitions"))).allowed).toBe(false);
  });

  it("rejects a tampered session cookie", async () => {
    const value = await createSessionCookieValue("acct_1", "ADMIN");
    const tampered = value.slice(0, -1) + (value.endsWith("a") ? "b" : "a");
    const result = await checkAdminAccess(req("/admin", tampered));
    expect(result.allowed).toBe(false);
  });

  it("rejects a valid signature for a non-ADMIN role", async () => {
    const value = await createSessionCookieValue("acct_1", "CUSTOMER");
    const result = await checkAdminAccess(req("/admin", value));
    expect(result.allowed).toBe(false);
    expect(result.role).toBe("CUSTOMER");
  });

  it("grants access for a valid ADMIN session and surfaces accountId", async () => {
    const value = await createSessionCookieValue("acct_1", "ADMIN");
    const result = await checkAdminAccess(req("/admin", value));
    expect(result.allowed).toBe(true);
    expect(result.role).toBe("ADMIN");
    expect(result.accountId).toBe("acct_1");
  });
});
