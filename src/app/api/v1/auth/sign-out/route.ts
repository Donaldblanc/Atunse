import { NextResponse, type NextRequest } from "next/server";
import { verifiedAdminSession } from "@/features/accounts/admin-check";
import { PrismaAccountRepository } from "@/features/accounts/repositories/prisma-account-repository";
import { clearedSessionCookieOptions, SESSION_COOKIE_NAME } from "@/features/accounts/session";
import { redactForLog } from "@/shared/logging/redact";
import { prisma } from "@/shared/db/prisma-client";

// POST /api/v1/auth/sign-out — ends the admin session: bumps the Account's
// sessionVersion (so a copied cookie stops working, not just this browser's
// copy) and clears the cookie. No auth check needed: signing out an
// already-signed-out or invalid session is a no-op. Only a still-valid
// session bumps, so an already-revoked (e.g. stolen, then replayed) cookie
// can't keep signing the real admin out. The cookie is cleared even if the
// database call fails.
export async function POST(req: NextRequest) {
  try {
    const accounts = new PrismaAccountRepository(prisma);
    // Explicit versions bypass the per-render memo: this must see the live version.
    const session = await verifiedAdminSession(req.cookies.get(SESSION_COOKIE_NAME)?.value, accounts);
    if (session) await accounts.bumpAdminSessionVersion(session.accountId);
  } catch (err) {
    console.error(`[auth] admin sign-out could not revoke the session: ${redactForLog(err instanceof Error ? err.message : String(err))}`);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", clearedSessionCookieOptions());
  return response;
}
