import { cache } from "react";
import type { NextRequest } from "next/server";
import { defaultAdminSessionVersions, type AdminSessionVersions } from "./admin-session-versions";
import type { Role } from "./authz";
import { SESSION_COOKIE_NAME, verifySessionCookieValue, type SessionPayload } from "./session";

export interface AdminCheckResult {
  allowed: boolean;
  role: Role;
  accountId: string | null;
}

/**
 * The actual admin-access decision, used by src/proxy.ts, the admin API
 * routes, the admin layout and every admin page and action.
 *
 * Interim implementation (ADR-0005 addendum): verifies the signed session
 * cookie set by POST /api/v1/auth/sign-in, then checks its sessionVersion
 * against the Account's current one, so signing out or changing the
 * password/email revokes cookies already issued. Still fails closed: a
 * missing, expired, tampered, revoked or non-ADMIN session is rejected.
 */
export async function checkAdminAccess(
  req: NextRequest,
  versions?: AdminSessionVersions,
): Promise<AdminCheckResult> {
  return adminFromCookieValue(req.cookies.get(SESSION_COOKIE_NAME)?.value, versions);
}

/**
 * The verified admin session in a raw cookie value, or null: signature and
 * expiry good, role ADMIN, and sessionVersion still current. The single
 * choke point every admin check goes through.
 *
 * With the default (database) versions, the result is memoized per cookie
 * value for the length of one React render pass (React `cache`), so the
 * layout, page and panels of one admin render hit the database once instead
 * of 5-10 times. React scopes that to a single request and it is a plain
 * pass-through outside a render (route handlers, the proxy, tests), so
 * sign-out always sees the live version. Keyed by cookie value, so a
 * re-issued cookie (password/email change) is looked up afresh.
 */
export async function verifiedAdminSession(
  cookie: string | undefined,
  versions?: AdminSessionVersions,
): Promise<SessionPayload | null> {
  return versions ? checkSession(cookie, versions) : cachedForRender(cookie);
}

const cachedForRender = cache((cookie: string | undefined) => checkSession(cookie, defaultAdminSessionVersions()));

async function checkSession(cookie: string | undefined, versions: AdminSessionVersions): Promise<SessionPayload | null> {
  const session = await verifySessionCookieValue(cookie);
  if (session?.role !== "ADMIN") return null;
  const current = await versions.findAdminSessionVersion(session.accountId);
  return current !== null && current === session.sessionVersion ? session : null;
}

/**
 * The same decision from a raw admin-session cookie value, for places that
 * aren't handed a NextRequest (the admin layout's server-side re-check).
 */
export async function adminFromCookieValue(
  cookie: string | undefined,
  versions?: AdminSessionVersions,
): Promise<AdminCheckResult> {
  const admin = await verifiedAdminSession(cookie, versions);
  if (admin) return { allowed: true, role: "ADMIN", accountId: admin.accountId };
  // Report a signature-valid non-admin role (a customer token) as itself; a revoked admin session is a guest.
  const session = await verifySessionCookieValue(cookie);
  if (session && session.role !== "ADMIN") return { allowed: false, role: session.role, accountId: session.accountId };
  return { allowed: false, role: "GUEST", accountId: null };
}
