import { NextResponse, type NextRequest } from "next/server";
import { buildOrderUseCaseDeps } from "@/features/orders/deps";
import { submitOrder, PolicyNotAcceptedError } from "@/features/orders/use-cases/submit-order";

// POST /api/v1/orders — the customer-facing submit step of the Phase 1
// vertical slice. Publicly reachable (guest or account holder); the
// authorization check itself still lives in the use-case (ADR-0012), not
// here — this route just derives who's calling.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseSubmitOrderBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // No auth provider wired yet (ADR-0005) — every caller here is a guest
  // for now; an authenticated Customer's accountId will replace this once
  // sessions exist.
  const actingUser = { accountId: null, role: "GUEST" as const };

  try {
    const order = await submitOrder(buildOrderUseCaseDeps(), actingUser, parsed.value);
    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    if (err instanceof PolicyNotAcceptedError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

function parseSubmitOrderBody(
  body: unknown,
): { ok: true; value: Parameters<typeof submitOrder>[2] } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be an object" };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.guestEmail !== "string" || b.guestEmail.length === 0) {
    return { ok: false, error: "guestEmail is required" };
  }
  if (typeof b.policyAccepted !== "boolean") {
    return { ok: false, error: "policyAccepted must be a boolean" };
  }
  const item = b.item as Record<string, unknown> | undefined;
  if (!item || !Array.isArray(item.photoKeys)) {
    return { ok: false, error: "item.photoKeys is required (from presigned S3 uploads)" };
  }

  return {
    ok: true,
    value: {
      guestEmail: b.guestEmail,
      guestPhone: typeof b.guestPhone === "string" ? b.guestPhone : null,
      policyAccepted: b.policyAccepted,
      item: {
        brand: typeof item.brand === "string" ? item.brand : null,
        model: typeof item.model === "string" ? item.model : null,
        description: typeof item.description === "string" ? item.description : null,
        photoKeys: item.photoKeys.filter((k): k is string => typeof k === "string"),
      },
    },
  };
}
