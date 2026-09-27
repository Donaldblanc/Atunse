import type { ActingUser } from "./authz";
import { CUSTOMER_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME, verifySessionCookieValue } from "./session";

const GUEST: ActingUser = { accountId: null, role: "GUEST" };

type CookieReader = { get(name: string): { value: string } | undefined };

/**
 * The customer calling a customer-facing route (booking, sign-in): a
 * signed-in Customer from the customer session cookie, otherwise GUEST.
 * The admin cookie is deliberately ignored, so admins go through the
 * booking flow like any signed-out customer (ADR-0014).
 */
export async function customerFromCookies(cookies: CookieReader): Promise<ActingUser> {
  const session = await verifySessionCookieValue(cookies.get(CUSTOMER_SESSION_COOKIE_NAME)?.value);
  return session?.role === "CUSTOMER" ? { accountId: session.accountId, role: "CUSTOMER" } : GUEST;
}

/**
 * The caller of a route both sides use (order photos): an Admin from the
 * admin session cookie, else a Customer from the customer one, else GUEST.
 * Use-cases then make the authorization decision (ADR-0012).
 */
export async function actingUserFromCookies(cookies: CookieReader): Promise<ActingUser> {
  const admin = await verifySessionCookieValue(cookies.get(SESSION_COOKIE_NAME)?.value);
  if (admin?.role === "ADMIN") return { accountId: admin.accountId, role: "ADMIN" };
  return customerFromCookies(cookies);
}
