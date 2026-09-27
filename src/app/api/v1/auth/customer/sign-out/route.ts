import { NextResponse } from "next/server";
import { clearedSessionCookieOptions, CUSTOMER_SESSION_COOKIE_NAME } from "@/features/accounts/session";

// POST /api/v1/auth/customer/sign-out — ends the customer session (the
// email-code login, ADR-0014), leaving any admin session alone. No auth
// check needed: signing out an already-signed-out session is a no-op.
// POST only (Next answers 405 to GET), so a link or image can't sign
// anyone out. Sessions are stateless signed cookies: this removes the
// cookie from the browser, but a copied token stays valid until it
// expires; server-side revocation comes with a managed auth provider
// (ADR-0005). The booking flow has no sign-out control yet; the
// "my bookings" page will.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CUSTOMER_SESSION_COOKIE_NAME, "", clearedSessionCookieOptions());
  return response;
}
