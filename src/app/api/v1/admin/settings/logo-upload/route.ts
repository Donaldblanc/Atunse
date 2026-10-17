import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkAdminAccess } from "@/features/accounts/admin-check";
import { UnauthorizedError } from "@/features/accounts/authz";
import { buildSettingsDeps } from "@/features/settings/deps";
import { InvalidLogoUploadError, requestLogoUpload } from "@/features/settings/use-cases/request-logo-upload";
import { StorageNotConfiguredError } from "@/shared/storage";
import { redactForLog } from "@/shared/logging/redact";

const body = z.object({ contentType: z.string().max(100), size: z.number().int() });

// POST /api/v1/admin/settings/logo-upload — Business Profile's Business
// Logo upload target, same FileStorage adapter as /api/v1/uploads
// (ADR-0004), but admin-only: the browser POSTs the file straight to the
// returned target, then calls Save Changes with the returned key.
export async function POST(req: NextRequest) {
  const { allowed, accountId } = await checkAdminAccess(req);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "contentType and size are required" }, { status: 400 });

  const actingUser = { accountId, role: "ADMIN" as const };

  try {
    const upload = await requestLogoUpload(buildSettingsDeps(), actingUser, parsed.data);
    return NextResponse.json({ upload }, { status: 201 });
  } catch (err) {
    if (err instanceof InvalidLogoUploadError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof StorageNotConfiguredError) {
      console.error(`[settings] ${redactForLog(err.message)}`);
      return NextResponse.json({ error: "Logo uploads are temporarily unavailable." }, { status: 503 });
    }
    throw err;
  }
}
