import { NextResponse, type NextRequest } from "next/server";
import { buildOrderUseCaseDeps } from "@/features/orders/deps";
import { parseSubmitOrderRequest, toSubmitOrderResponse } from "@/features/orders/api/submit-order-request";
import { customerFromCookies } from "@/features/accounts/acting-user";
import {
  BookingValidationError,
  PolicyNotAcceptedError,
  SignInRequiredError,
  submitOrder,
} from "@/features/orders/use-cases/submit-order";

// POST /api/v1/orders — the customer-facing submit step of the Phase 1
// vertical slice (/booking's "Confirm Booking"). Publicly reachable
// (signed out, or a signed-in Customer); the authorization check itself
// still lives in the use-case (ADR-0012), not here — this route just
// derives who's calling (the customer session only: a signed-in admin
// books like any signed-out customer, ADR-0014). An `Idempotency-Key`
// header (UUID) makes retries return the same Order. A 409 with code
// SIGN_IN_REQUIRED means the email already has a Customer Account: the
// booking flow shows its login screen.
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

  const actingUser = await customerFromCookies(req.cookies);

  const deps = buildOrderUseCaseDeps();
  try {
    const order = await submitOrder(deps, actingUser, parsed.value);
    return NextResponse.json(toSubmitOrderResponse(order, deps.paymentInstructions), { status: 201 });
  } catch (err) {
    if (err instanceof PolicyNotAcceptedError || err instanceof BookingValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof SignInRequiredError) {
      return NextResponse.json({ error: err.message, code: "SIGN_IN_REQUIRED" }, { status: 409 });
    }
    throw err;
  }
}
