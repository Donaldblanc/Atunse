import { beforeAll, describe, expect, it } from "vitest";
import { actingUserFromCookies, customerFromCookies } from "./acting-user";
import { createSessionCookieValue, CUSTOMER_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "./session";

function jar(values: Record<string, string>) {
  return { get: (name: string) => (name in values ? { value: values[name]! } : undefined) };
}

let adminToken: string;
let customerToken: string;

beforeAll(async () => {
  process.env.SESSION_SECRET = "test-secret";
  adminToken = await createSessionCookieValue("acc_admin", "ADMIN");
  customerToken = await createSessionCookieValue("acc_customer", "CUSTOMER");
});

describe("customerFromCookies (booking, sign-in)", () => {
  it("reads the customer session", async () => {
    expect(await customerFromCookies(jar({ [CUSTOMER_SESSION_COOKIE_NAME]: customerToken }))).toEqual({
      accountId: "acc_customer",
      role: "CUSTOMER",
    });
  });

  it("ignores the admin session, so an admin goes through booking as a signed-out customer", async () => {
    expect(await customerFromCookies(jar({ [SESSION_COOKIE_NAME]: adminToken }))).toEqual({ accountId: null, role: "GUEST" });
  });

  it("never accepts an admin token placed in the customer cookie", async () => {
    expect(await customerFromCookies(jar({ [CUSTOMER_SESSION_COOKIE_NAME]: adminToken }))).toMatchObject({ role: "GUEST" });
  });
});

describe("actingUserFromCookies (routes both sides use)", () => {
  it("prefers the admin session, then the customer one, else GUEST", async () => {
    const both = jar({ [SESSION_COOKIE_NAME]: adminToken, [CUSTOMER_SESSION_COOKIE_NAME]: customerToken });
    expect(await actingUserFromCookies(both)).toMatchObject({ role: "ADMIN", accountId: "acc_admin" });
    expect(await actingUserFromCookies(jar({ [CUSTOMER_SESSION_COOKIE_NAME]: customerToken }))).toMatchObject({ role: "CUSTOMER" });
    expect(await actingUserFromCookies(jar({}))).toMatchObject({ role: "GUEST" });
  });

  it("never treats a customer token in the admin cookie as an admin", async () => {
    expect(await actingUserFromCookies(jar({ [SESSION_COOKIE_NAME]: customerToken }))).toMatchObject({ role: "GUEST" });
  });
});
