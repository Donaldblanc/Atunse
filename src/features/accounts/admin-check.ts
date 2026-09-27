import type { NextRequest } from "next/server";
import type { Role } from "./authz";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "./session";

export interface AdminCheckResult {
  allowed: boolean;
  role: Role;
  accountId: string | null;
}

/**
 * The actual admin-access decision, extracted out of src/proxy.ts so
 * it's unit-testable without spinning up the Next.js proxy runtime.
 *
 * Interim implementation (ADR-0005 addendum): verifies the signed session
 * cookie set by POST /api/v1/auth/sign-in. Still fails closed — a missing,
 * expired, tampered, or non-ADMIN session is rejected the same way an
 * absent session always was. Swap resolveSessionRole's body for a managed
 * provider's verification once one is chosen; callers (middleware, API
 * routes) don't need to change.
 */
export async function checkAdminAccess(req: NextRequest): Promise<AdminCheckResult> {
  return adminFromCookieValue(req.cookies.get(SESSION_COOKIE_NAME)?.value);
}

/**
 * The same decision from a raw admin-session cookie value, for places that
 * aren't handed a NextRequest (the admin layout's server-side re-check).
 */
export async function adminFromCookieValue(cookie: string | undefined): Promise<AdminCheckResult> {
  const session = await verifySessionCookieValue(cookie);
  const role: Role = session?.role ?? "GUEST";
  return { allowed: role === "ADMIN", role, accountId: session?.accountId ?? null };
}
