import { NextResponse, type NextRequest } from "next/server";
import { actingUserFromSessionCookie } from "@/features/accounts/acting-user";
import { UnauthorizedError } from "@/features/accounts/authz";
import { SESSION_COOKIE_NAME } from "@/features/accounts/session";
import { buildOrderUseCaseDeps } from "@/features/orders/deps";
import { getOrderPhotos, OrderNotFoundError } from "@/features/orders/use-cases/get-order-photos";
import { getFileStorage, StorageNotConfiguredError } from "@/shared/storage";

// GET /api/v1/orders/:orderId/photos — short-lived view links for an
// Order's photos (ADR-0014). Signed in only: an Admin sees any Order's
// photos, a Customer only their own. The use-case makes that decision.
export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  const actingUser = await actingUserFromSessionCookie(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  const { orders, customerSignInEnabled } = buildOrderUseCaseDeps();

  try {
    const photos = await getOrderPhotos(
      { orders, storage: getFileStorage(), customerSignInEnabled },
      actingUser,
      params.orderId,
    );
    return NextResponse.json(photos, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Sign in to view photos." }, { status: 401 });
    if (err instanceof OrderNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof StorageNotConfiguredError) {
      console.error(`[photos] ${err.message}`);
      return NextResponse.json({ error: "Photos are temporarily unavailable." }, { status: 503 });
    }
    throw err;
  }
}
