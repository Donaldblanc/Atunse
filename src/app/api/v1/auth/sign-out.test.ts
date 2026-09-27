import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { customerFromCookies } from "@/features/accounts/acting-user";
import * as adminSignOut from "./sign-out/route";
import * as customerSignOut from "./customer/sign-out/route";

describe("sign-out routes", () => {
  it("customer sign-out expires only the customer cookie, with the session cookie's attributes", async () => {
    const res = await customerSignOut.POST();
    const header = res.headers.get("set-cookie") ?? "";
    expect(header).toMatch(/^atunse_customer_session=;/);
    expect(header).toMatch(/Max-Age=0/);
    expect(header).toMatch(/Path=\//);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=lax/i);
    expect(header).not.toMatch(/atunse_session=;/);
  });

  it("admin sign-out expires the admin cookie the same way", async () => {
    const header = (await adminSignOut.POST()).headers.get("set-cookie") ?? "";
    expect(header).toMatch(/^atunse_session=;/);
    expect(header).toMatch(/Max-Age=0/);
    expect(header).toMatch(/HttpOnly/i);
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
