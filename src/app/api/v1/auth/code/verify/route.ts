import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildSignInCodeDeps, SignInUnavailableError } from "@/features/accounts/deps";
import {
  createSessionCookieValue,
  CUSTOMER_SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE_SECONDS,
} from "@/features/accounts/session";
import { InvalidSignInCodeError, verifySignInCode } from "@/features/accounts/use-cases/verify-sign-in-code";
import { isCustomerSignInEnabled } from "@/shared/config/feature-flags";

const body = z.object({ email: z.string().trim().email().max(254), code: z.string().trim().regex(/^\d{6}$/) });

// POST /api/v1/auth/code/verify — exchanges a valid emailed code for the
// customer session cookie (ADR-0014), separate from the admin session. Doesn't exist while the
// FEATURE_CUSTOMER_SIGN_IN_ENABLED toggle is off.
export async function POST(req: NextRequest) {
  if (!isCustomerSignInEnabled()) return new NextResponse(null, { status: 404 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter the 6-digit code from the email." }, { status: 400 });

  try {
    const { accountId } = await verifySignInCode(buildSignInCodeDeps(), parsed.data.email, parsed.data.code);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(CUSTOMER_SESSION_COOKIE_NAME, await createSessionCookieValue(accountId, "CUSTOMER"), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  } catch (err) {
    if (err instanceof InvalidSignInCodeError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof SignInUnavailableError) {
      console.error(`[sign-in] ${err.message}`);
      return NextResponse.json({ error: "Sign-in is temporarily unavailable." }, { status: 503 });
    }
    throw err;
  }
}
