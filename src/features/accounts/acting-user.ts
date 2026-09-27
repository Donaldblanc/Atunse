import type { ActingUser } from "./authz";
import { verifySessionCookieValue } from "./session";

/**
 * Who is calling, from the signed session cookie: a signed-in Customer or
 * Admin, or GUEST when there's no valid session. Routes pass this to
 * use-cases, which make the authorization decision (ADR-0012).
 */
export async function actingUserFromSessionCookie(cookie: string | undefined): Promise<ActingUser> {
  const session = await verifySessionCookieValue(cookie);
  return session ? { accountId: session.accountId, role: session.role } : { accountId: null, role: "GUEST" };
}
