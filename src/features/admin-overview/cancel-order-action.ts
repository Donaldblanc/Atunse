"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { UnauthorizedError } from "@/features/accounts/authz";
import { buildOrderUseCaseDeps } from "@/features/orders/deps";
import { ItemStatusChangedError, OrderNotFoundError } from "@/features/orders/repositories/order-repository";
import { cancelOrder, OrderNotCancellableError } from "@/features/orders/use-cases/cancel-order";
import { MoveNotAllowedError } from "@/features/orders/use-cases/transition-item-status";
import { redactForLog } from "@/shared/logging/redact";

export type CancelOrderResult = { ok: true } | { ok: false; error: string };

/**
 * Recent Orders' "Cancel order". The client makes `idempotencyKey` once per
 * row (ADR-0012), so a double click or retry cancels once. An Order already
 * cancelled counts as done.
 */
export async function cancelOrderAction(orderId: string, idempotencyKey: string): Promise<CancelOrderResult> {
  if (typeof orderId !== "string" || typeof idempotencyKey !== "string" || !orderId || !idempotencyKey) {
    return { ok: false, error: "Something went wrong. Reload and try again." };
  }
  try {
    const actingUser = await actingUserFromCookies(await cookies());
    await cancelOrder(buildOrderUseCaseDeps(), actingUser, { orderId, idempotencyKey });
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: "Your session has ended. Sign in again." };
    if (err instanceof OrderNotFoundError) return { ok: false, error: "This order no longer exists." };
    if (err instanceof OrderNotCancellableError || err instanceof MoveNotAllowedError) return { ok: false, error: err.message };
    if (err instanceof ItemStatusChangedError) return { ok: false, error: "This order changed since you loaded it. Reload and try again." };
    console.error(`[admin-overview] cancelling an order failed: ${redactForLog(err instanceof Error ? err.message : String(err))}`);
    return { ok: false, error: "Couldn't cancel it. Try again." };
  }
  revalidatePath("/admin");
  return { ok: true };
}
