import { NextResponse, type NextRequest } from "next/server";
import { buildOrderUseCaseDeps } from "@/features/orders/deps";
import { parseSubmitOrderRequest, toSubmitOrderResponse } from "@/features/orders/api/submit-order-request";
import { BookingValidationError, PolicyNotAcceptedError, submitOrder } from "@/features/orders/use-cases/submit-order";

// POST /api/v1/orders — the customer-facing submit step of the Phase 1
// vertical slice (/booking's "Confirm Booking"). Publicly reachable (guest
// or account holder); the authorization check itself still lives in the
// use-case (ADR-0012), not here — this route just derives who's calling.
// An `Idempotency-Key` header (UUID) makes retries return the same Order.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseSubmitOrderRequest(body, req.headers.get("idempotency-key"));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // No auth provider wired yet (ADR-0005) — every caller here is a guest
  // for now; an authenticated Customer's accountId will replace this once
  // sessions exist.
  const actingUser = { accountId: null, role: "GUEST" as const };

  const deps = buildOrderUseCaseDeps();
  try {
    const order = await submitOrder(deps, actingUser, parsed.value);
    return NextResponse.json(toSubmitOrderResponse(order, deps.paymentInstructions), { status: 201 });
  } catch (err) {
    if (err instanceof PolicyNotAcceptedError || err instanceof BookingValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
