import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildSignInCodeDeps } from "@/features/accounts/deps";
import { requestSignInCode, TooManyCodeRequestsError } from "@/features/accounts/use-cases/request-sign-in-code";
import { isCustomerSignInEnabled } from "@/shared/config/feature-flags";

const body = z.object({ email: z.string().trim().email().max(254) });

// POST /api/v1/auth/code/request — emails a customer sign-in code
// (ADR-0014). Answers 202 whether or not the email has an account, so it
// can't be used to probe emails. Doesn't exist while the
// FEATURE_CUSTOMER_SIGN_IN_ENABLED toggle is off.
export async function POST(req: NextRequest) {
  if (!isCustomerSignInEnabled()) return new NextResponse(null, { status: 404 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  try {
    await requestSignInCode(buildSignInCodeDeps(), parsed.data.email);
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (err) {
    if (err instanceof TooManyCodeRequestsError) return NextResponse.json({ error: err.message }, { status: 429 });
    throw err;
  }
}
