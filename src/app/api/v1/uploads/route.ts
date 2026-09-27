import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requestPhotoUploads } from "@/features/orders/use-cases/request-photo-uploads";
import { BookingValidationError } from "@/features/orders/use-cases/submit-order";
import { buildOrderUseCaseDeps } from "@/features/orders/deps";
import { StorageNotConfiguredError } from "@/shared/storage";

const body = z.object({
  files: z.array(z.object({ contentType: z.string().max(100), size: z.number().int() })).max(20),
});

// POST /api/v1/uploads — presigned upload targets for /booking's photos
// (ADR-0004). Returns { uploads: [{ key, url, fields }] }; the browser
// POSTs each file straight to its target, then submits the keys with
// POST /api/v1/orders.
export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "files must be a list of { contentType, size }" }, { status: 400 });
  }

  // Anonymous on purpose: a key only gains an owner when submitOrder
  // attaches it to an Order (ADR-0014), and a key can be attached once.
  const actingUser = { accountId: null, role: "GUEST" as const };

  try {
    const uploads = await requestPhotoUploads(buildOrderUseCaseDeps(), actingUser, parsed.data.files);
    return NextResponse.json({ uploads }, { status: 201 });
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof StorageNotConfiguredError) {
      console.error(`[uploads] ${err.message}`);
      return NextResponse.json({ error: "Photo uploads are temporarily unavailable." }, { status: 503 });
    }
    throw err;
  }
}
