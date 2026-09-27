import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildSignInCodeDeps, SignInUnavailableError } from "@/features/accounts/deps";
import { createSessionCookieValue, CUSTOMER_SESSION_COOKIE_NAME, sessionCookieOptions } from "@/features/accounts/session";
import { InvalidSignInCodeError, verifySignInCode } from "@/features/accounts/use-cases/verify-sign-in-code";
import { isCustomerSignInEnabled } from "@/shared/config/feature-flags";
import { limitByIp, RATE_LIMITS } from "@/shared/rate-limit";
import { redactForLog } from "@/shared/logging/redact";

const body = z.object({ email: z.string().trim().email().max(254), code: z.string().trim().regex(/^\d{6}$/) });

// POST /api/v1/auth/code/verify — exchanges a valid emailed code for the
// customer session cookie (ADR-0014), separate from the admin session. Doesn't exist while the
// FEATURE_CUSTOMER_SIGN_IN_ENABLED toggle is off.
export async function POST(req: NextRequest) {
  if (!isCustomerSignInEnabled()) return new NextResponse(null, { status: 404 });
  // Caps guesses per caller across all emails, on top of the per-account
  // limits in SignInCodes (#77).
  const limited = await limitByIp(req, RATE_LIMITS.codeVerify);
  if (limited) return limited;

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter the 6-digit code from the email." }, { status: 400 });

  try {
    const { accountId } = await verifySignInCode(buildSignInCodeDeps(), parsed.data.email, parsed.data.code);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(CUSTOMER_SESSION_COOKIE_NAME, await createSessionCookieValue(accountId, "CUSTOMER"), sessionCookieOptions());
    return response;
  } catch (err) {
    if (err instanceof InvalidSignInCodeError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof SignInUnavailableError) {
      console.error(`[sign-in] ${redactForLog(err.message)}`);
      return NextResponse.json({ error: "Sign-in is temporarily unavailable." }, { status: 503 });
    }
    throw err;
  }
}
