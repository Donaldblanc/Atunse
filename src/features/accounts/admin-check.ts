import type { NextRequest } from "next/server";
import type { Role } from "./authz";

export interface AdminCheckResult {
  allowed: boolean;
  role: Role;
}

/**
 * The actual admin-access decision, extracted out of src/middleware.ts so
 * it's unit-testable without spinning up the Next.js middleware runtime.
 *
 * Fail-closed placeholder until a real managed auth provider is wired in
 * (ADR-0005): nobody is ever recognized as ADMIN yet, so /admin and
 * /api/v1/admin/* stay inaccessible rather than trusting an absent
 * session. Swap the body of this function for real session/JWT
 * verification once a provider is chosen — callers (middleware, API
 * routes) don't need to change.
 */
export function checkAdminAccess(_req: NextRequest): AdminCheckResult {
  const role = resolveSessionRole(_req);
  return { allowed: role === "ADMIN", role };
}

// Isolated so its return type stays `Role` (not narrowed to a literal) —
// swap the body for real session/JWT verification once a provider (ADR-0005)
// is chosen. Always "GUEST" today: nobody is ever recognized as ADMIN.
function resolveSessionRole(_req: NextRequest): Role {
  return "GUEST";
}
