import { NextResponse, type NextRequest } from "next/server";

/**
 * Extra checks for state-changing admin JSON routes, on top of the
 * SameSite=Lax session cookie. Returns the response to send, or null.
 *
 * - Origin: when the browser sends one it must be this site's own host, the
 *   same rule Next applies to Server Actions (Origin against Host or
 *   X-Forwarded-Host). A request with no Origin header (non-browser
 *   clients) is let through, as Next does; it still needs the session.
 * - Content-Type must be application/json, so a cross-site form post
 *   (which can only send form or text types without a preflight) is refused.
 */
export function rejectCrossSiteOrNonJson(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  if (origin !== null) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      // "null" or garbage: not our origin
    }
    if (!host || originHost !== host) return NextResponse.json({ error: "Cross-origin request refused" }, { status: 403 });
  }

  const contentType = req.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  return null;
}
