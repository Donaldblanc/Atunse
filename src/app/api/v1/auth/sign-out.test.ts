import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { customerFromCookies } from "@/features/accounts/acting-user";
import { CUSTOMER_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/features/accounts/session";
import * as adminSignOut from "./sign-out/route";
import * as customerSignOut from "./customer/sign-out/route";

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
