import { NextResponse, type NextRequest } from "next/server";
import { checkAdminAccess } from "@/features/accounts/admin-check";

// Admin routes are protected from the FIRST deployment, not a later phase.
// The actual decision lives in checkAdminAccess (features/accounts) so it's
// unit-testable on its own; this file just wires it into Next's routing.
export function middleware(req: NextRequest) {
  const { allowed } = checkAdminAccess(req);
  if (!allowed) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
}

export const config = {
  // Admin pages AND the admin-only API surface — both must fail closed.
  matcher: ["/admin/:path*", "/api/v1/admin/:path*"],
};
