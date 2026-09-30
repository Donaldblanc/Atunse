"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { requireRole, UnauthorizedError } from "@/features/accounts/authz";
import { buildOrderUseCaseDeps } from "@/features/orders/deps";
import { adminStatusMoves, ITEM_STATUSES, ITEM_STATUS_LABELS, type ItemStatus } from "@/features/orders/domain";
import { ItemNotFoundError, ItemStatusChangedError } from "@/features/orders/repositories/order-repository";
import { InvalidTransitionError, transitionItemStatus } from "@/features/orders/use-cases/transition-item-status";

export type UpdateStatusState = { error: string | null };

function statusField(formData: FormData, name: string): ItemStatus | null {
  const value = formData.get(name);
  return ITEM_STATUSES.find((status) => status === value) ?? null;
}

/**
 * Order detail's Update Status: moves one pair to the next step or cancels
 * it, through the same use-case the admin API route uses. `fromStatus` is
 * the status the screen showed, so a stale dialog is refused instead of
 * skipping a step; the idempotency key (made when the form rendered) makes
 * a double submit apply once (ADR-0012). The move is checked against
 * adminStatusMoves again here, not just in the form, so a step held on the
 * quote or the deposit can't be forced. Failures come back as a message
 * for the form to show.
 */
export async function updateItemStatusAction(_previous: UpdateStatusState, formData: FormData): Promise<UpdateStatusState> {
  const orderId = formData.get("orderId");
  const itemId = formData.get("itemId");
  const idempotencyKey = formData.get("idempotencyKey");
  const fromStatus = statusField(formData, "fromStatus");
  const toStatus = statusField(formData, "toStatus");
  if (typeof orderId !== "string" || !orderId || typeof itemId !== "string" || !itemId || typeof idempotencyKey !== "string" || !idempotencyKey || !fromStatus || !toStatus) {
    return { error: "That request wasn't valid. Reload and try again." };
  }

  try {
    const actingUser = await actingUserFromCookies(await cookies());
    // Before reading the Order, so a non-admin learns nothing about it (ADR-0012).
    requireRole(actingUser, "ADMIN");
    const deps = buildOrderUseCaseDeps();
    const order = await deps.orders.findById(orderId);
    const item = order?.items.find((candidate) => candidate.id === itemId);
    if (!order || !item) return { error: "This pair no longer exists." };
    const { moves, held } = adminStatusMoves(item, order);
    if (item.status === fromStatus && !moves.includes(toStatus)) {
      return { error: held ?? `A pair can't move from ${ITEM_STATUS_LABELS[fromStatus]} to ${ITEM_STATUS_LABELS[toStatus]}.` };
    }
    await transitionItemStatus(deps, actingUser, {
      itemId,
      fromStatus,
      toStatus,
      action: "STATUS_TRANSITION",
      idempotencyKey,
    });
  } catch (err) {
    if (err instanceof ItemStatusChangedError) return { error: err.message };
    if (err instanceof InvalidTransitionError)
      return {
        error: `A pair can't move from ${ITEM_STATUS_LABELS[fromStatus]} to ${ITEM_STATUS_LABELS[toStatus]}.`,
      };
    if (err instanceof ItemNotFoundError) return { error: "This pair no longer exists." };
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that." };
    throw err;
  }

  // The dialog and the Overview's counts (Needs Attention, Recent Orders) all read this.
  revalidatePath("/admin");
  return { error: null };
}
