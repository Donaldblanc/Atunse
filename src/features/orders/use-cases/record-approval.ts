import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { OrderRepository } from "../repositories/order-repository";

/** The audit action for the owner recording that the customer approved a quote; actorAccountId says who. */
export const APPROVAL_RECORDED = "APPROVAL_RECORDED";

/**
 * The customer said yes to a pair's quote (by text, call or email reply);
 * the owner records it, moving the pair QUOTE_SENT to APPROVED. There is no
 * customer-facing approval page (owner's decision). Admin-only. The customer
 * isn't emailed: they just told us. Idempotent on `idempotencyKey`
 * (ADR-0012): "already-recorded" on a replay. A pair no longer Quote Sent is
 * refused by the repository with ItemStatusChangedError.
 */
export async function recordApproval(
  deps: { orders: OrderRepository },
  actingUser: ActingUser,
  input: { itemId: string; idempotencyKey: string },
): Promise<"recorded" | "already-recorded"> {
  requireRole(actingUser, "ADMIN");
  if (!input.idempotencyKey) throw new Error("recordApproval needs an idempotencyKey");
  const updated = await deps.orders.transitionItemStatus({
    itemId: input.itemId,
    toStatus: "APPROVED",
    entry: {
      action: APPROVAL_RECORDED,
      fromStatus: "QUOTE_SENT",
      toStatus: "APPROVED",
      actorAccountId: actingUser.accountId,
      idempotencyKey: input.idempotencyKey,
    },
  });
  return updated ? "recorded" : "already-recorded";
}
