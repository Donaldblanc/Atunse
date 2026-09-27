import { NextResponse, type NextRequest } from "next/server";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { UnauthorizedError } from "@/features/accounts/authz";
import { buildOrderUseCaseDeps } from "@/features/orders/deps";
import { getOrderPhotos, OrderNotFoundError } from "@/features/orders/use-cases/get-order-photos";
import { StorageNotConfiguredError } from "@/shared/storage";
import { redactForLog } from "@/shared/logging/redact";

// GET /api/v1/orders/:orderId/photos — short-lived view links for an
// Order's photos (ADR-0014). Signed in only: an Admin (admin session)
// sees any Order's photos, a Customer (customer session) only their own.
// The use-case makes that decision.
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const actingUser = await actingUserFromCookies(req.cookies);

  try {
    const photos = await getOrderPhotos(buildOrderUseCaseDeps(), actingUser, orderId);
    return NextResponse.json(photos, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Sign in to view photos." }, { status: 401 });
    if (err instanceof OrderNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof StorageNotConfiguredError) {
      console.error(`[photos] ${redactForLog(err.message)}`);
      return NextResponse.json({ error: "Photos are temporarily unavailable." }, { status: 503 });
    }
    throw err;
  }
}
