import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { customerFromCookies } from "@/features/accounts/acting-user";
import { CUSTOMER_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/features/accounts/session";
import * as adminSignOut from "./sign-out/route";
import * as customerSignOut from "./customer/sign-out/route";

const { verified, bump } = vi.hoisted(() => ({ verified: vi.fn(), bump: vi.fn() }));
vi.mock("@/features/accounts/admin-check", () => ({ verifiedAdminSession: verified }));
vi.mock("@/shared/db/prisma-client", () => ({ prisma: {} }));
vi.mock("@/features/accounts/repositories/prisma-account-repository", () => ({
  PrismaAccountRepository: class {
    bumpAdminSessionVersion = bump;
    findAdminSessionVersion = vi.fn();
  },
}));

const withCookie = () =>
  new NextRequest("http://localhost/api/v1/auth/sign-out", { method: "POST", headers: { cookie: `${SESSION_COOKIE_NAME}=signed` } });

describe("admin sign-out revocation", () => {
  beforeEach(() => {
    verified.mockReset();
    bump.mockReset();
  });

  it("bumps the session version only for a still-valid admin session", async () => {
    verified.mockResolvedValue({ accountId: "a1", role: "ADMIN", sessionVersion: 0 });
    await adminSignOut.POST(withCookie());
    expect(bump).toHaveBeenCalledWith("a1");
  });

  it("does not bump for a revoked or invalid cookie, but still clears it", async () => {
    verified.mockResolvedValue(null);
    const res = await adminSignOut.POST(withCookie());
    expect(bump).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie") ?? "").toMatch(/Max-Age=0/);
  });

  it("still clears the cookie and answers ok when the database call throws", async () => {
    verified.mockResolvedValue({ accountId: "a1", role: "ADMIN", sessionVersion: 0 });
    bump.mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await adminSignOut.POST(withCookie());
    spy.mockRestore();
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie") ?? "").toMatch(/Max-Age=0/);
  });
});

describe("sign-out routes", () => {
  it("customer sign-out expires only the customer cookie, with the session cookie's attributes", async () => {
    const res = await customerSignOut.POST();
    const header = res.headers.get("set-cookie") ?? "";
    expect(header).toMatch(new RegExp(`^${CUSTOMER_SESSION_COOKIE_NAME}=;`));
    expect(header).toMatch(/Max-Age=0/);
    expect(header).toMatch(/Path=\//);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=lax/i);
    expect(header).not.toMatch(new RegExp(`^${SESSION_COOKIE_NAME}=;`));
  });

  it("admin sign-out expires the admin cookie the same way", async () => {
    const header = (await adminSignOut.POST(new NextRequest("http://localhost/api/v1/auth/sign-out", { method: "POST" }))).headers.get("set-cookie") ?? "";
    expect(header).toMatch(new RegExp(`^${SESSION_COOKIE_NAME}=;`));
    expect(header).toMatch(/Max-Age=0/);
    expect(header).toMatch(/HttpOnly/i);
  });

  it("uses __Host- cookie names, which need Secure, Path=/ and no Domain", async () => {
    expect(SESSION_COOKIE_NAME).toBe("__Host-atunse_session");
    expect(CUSTOMER_SESSION_COOKIE_NAME).toBe("__Host-atunse_customer_session");
    const header = (await customerSignOut.POST()).headers.get("set-cookie") ?? "";
    expect(header).toMatch(/Secure/i);
    expect(header).toMatch(/Path=\//);
    expect(header).not.toMatch(/Domain=/i);
  });

  it("only exists as POST, so a link or image can't sign anyone out", () => {
    expect(Object.keys(customerSignOut)).toEqual(["POST"]);
    expect(Object.keys(adminSignOut)).toEqual(["POST"]);
  });

  it("leaves the browser with no customer session afterwards", async () => {
    // What the browser sends after applying the cleared cookie: nothing.
    const after = new NextRequest("http://localhost/api/v1/orders/o_1/photos");
    expect(await customerFromCookies(after.cookies)).toEqual({ accountId: null, role: "GUEST" });
  });
});
