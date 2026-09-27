import { NextResponse } from "next/server";
import { CUSTOMER_SESSION_COOKIE_NAME } from "@/features/accounts/session";

// POST /api/v1/auth/customer/sign-out — ends the customer session (the
// email-code login, ADR-0014), leaving any admin session alone. No auth
// check needed: signing out an already-signed-out session is a no-op. The
// booking flow has no sign-out control yet; the "my bookings" page will.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(CUSTOMER_SESSION_COOKIE_NAME);
  return response;
}
