import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { OrderRepository } from "../repositories/order-repository";

/**
 * The owner marking an Order's Zelle/Cash Deposit received (ADR-0002), from
 * Pending Payments. Admin-only (ADR-0012).
 *
 * Why this isn't a transitionItemStatus call: that use-case records
 * MANUAL_PAYMENT_CONFIRMED as a side effect of moving one Item along the
 * pipeline, but nothing in the docs ties the Deposit to a particular step.
 * CONTEXT.md says the Deposit is "charged once at submission", so it is
 * normally still PENDING while every pair is REQUEST_SUBMITTED or
 * UNDER_REVIEW, where the only allowed moves are the review steps, not
 * "payment". ADR-0002 only gates what comes later ("the Order does not
 * advance past the Approved status" until the owner marks it received),
 * and it is the owner's review, not the payment, that advances a pair. So
 * this settles the Deposit Payment and writes the audit entry on each live
 * pair without touching any status.
 *
 * Idempotent on `idempotencyKey` (ADR-0012): a retry, e.g. a double click,
 * returns "already-confirmed" rather than an error. If the Deposit was
 * settled another way (or every pair was cancelled), the repository throws
 * NoPendingDepositError.
 */
export async function confirmDeposit(
  deps: { orders: Pick<OrderRepository, "confirmDeposit"> },
  actingUser: ActingUser,
  input: { orderId: string; idempotencyKey: string },
): Promise<"confirmed" | "already-confirmed"> {
  requireRole(actingUser, "ADMIN");
  const applied = await deps.orders.confirmDeposit({
    orderId: input.orderId,
    actorAccountId: actingUser.accountId,
    idempotencyKey: input.idempotencyKey,
  });
  return applied ? "confirmed" : "already-confirmed";
}
