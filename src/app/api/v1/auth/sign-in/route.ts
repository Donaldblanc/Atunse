import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/shared/db/prisma-client";
import { PrismaPasswordAuthService } from "@/features/accounts/auth-service";
import { limitByIp, limitByKey, RATE_LIMITS } from "@/shared/rate-limit";
import { SESSION_COOKIE_NAME, createSessionCookieValue, sessionCookieOptions } from "@/features/accounts/session";

// POST /api/v1/auth/sign-in — interim credential login (ADR-0005 addendum).
// Publicly reachable; there's nothing to authorize yet, only to
// authenticate. On success, sets the signed session cookie that
// checkAdminAccess (src/proxy.ts) later verifies.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseSignInBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Both limits count before the password is checked (a scrypt check is
  // the expensive part): per caller, and per email across all callers.
  const limited =
    (await limitByIp(req, RATE_LIMITS.adminSignIn)) ??
    (await limitByKey(RATE_LIMITS.adminSignInAccount, `admin-email:${parsed.value.email.trim().toLowerCase()}`));
  if (limited) return limited;

  const authService = new PrismaPasswordAuthService(prisma);
  const account = await authService.verifyCredentials(parsed.value.email, parsed.value.password);
  if (!account) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const response = NextResponse.json({ role: account.role });
  response.cookies.set(
    SESSION_COOKIE_NAME,
    await createSessionCookieValue(account.accountId, account.role),
    sessionCookieOptions(),
  );
  return response;
}

function parseSignInBody(
  body: unknown,
): { ok: true; value: { email: string; password: string } } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be an object" };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.email !== "string" || b.email.length === 0) {
    return { ok: false, error: "email is required" };
  }
  if (typeof b.password !== "string" || b.password.length === 0) {
    return { ok: false, error: "password is required" };
  }
  return { ok: true, value: { email: b.email, password: b.password } };
}
