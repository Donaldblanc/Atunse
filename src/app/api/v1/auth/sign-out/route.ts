import { NextResponse, type NextRequest } from "next/server";
import { PrismaAccountRepository } from "@/features/accounts/repositories/prisma-account-repository";
import { clearedSessionCookieOptions, SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/features/accounts/session";
import { prisma } from "@/shared/db/prisma-client";

// POST /api/v1/auth/sign-out — ends the admin session: bumps the Account's
// sessionVersion (so a copied cookie stops working, not just this browser's
// copy) and clears the cookie. No auth check needed: signing out an
// already-signed-out or invalid session is a no-op.
export async function POST(req: NextRequest) {
  const session = await verifySessionCookieValue(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (session?.role === "ADMIN") await new PrismaAccountRepository(prisma).bumpAdminSessionVersion(session.accountId);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", clearedSessionCookieOptions());
  return response;
}
