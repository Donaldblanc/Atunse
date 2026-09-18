import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/features/accounts/session";

// POST /api/v1/auth/sign-out — clears the session cookie. No auth check
// needed: signing out an already-signed-out session is a no-op.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
