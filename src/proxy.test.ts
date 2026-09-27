import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { proxy } from "./proxy";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "./features/accounts/session";

function req(path: string, cookie?: string): NextRequest {
  const headers = cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : undefined;
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

describe("proxy (admin route guard)", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret-0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("redirects an unauthenticated request to /admin, to /sign-in", async () => {
    const res = await proxy(req("/admin"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("from")).toBe("/admin");
  });

  it("redirects a nested admin path too, preserving it as `from`", async () => {
    const res = await proxy(req("/admin/orders/123"));
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("from")).toBe("/admin/orders/123");
  });

  it("redirects the admin-only API surface the same way", async () => {
    const res = await proxy(req("/api/v1/admin/items/1/transitions"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/sign-in");
  });

  it("lets a valid ADMIN session through", async () => {
    const cookie = await createSessionCookieValue("acct_1", "ADMIN");
    const res = await proxy(req("/admin", cookie));
    expect(res.status).toBe(200);
  });
});
