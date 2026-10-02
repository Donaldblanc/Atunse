import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { PaymentMethod } from "../domain";
import type { OrderRepository } from "../repositories/order-repository";

/** Only Zelle and Cash are confirmed by hand (ADR-0002); Card and Apple Pay confirm through the processor. */
const MANUAL_METHODS: readonly PaymentMethod[] = ["ZELLE", "CASH"];

/** The method the owner chose for a manual confirmation isn't Zelle or Cash. */
export class InvalidPaymentMethodError extends Error {
  constructor() {
    super("Choose Zelle or Cash.");
    this.name = "InvalidPaymentMethodError";
  }
}

/**
 * The owner marking a Zelle/Cash Deposit or Balance received (ADR-0002), from
 * Pending Payments or the Order dialog. Admin-only (ADR-0012). `method` is how
 * it actually arrived, which may differ from the one it was created with.
 *
 * Why this isn't a transitionItemStatus call: that use-case records
 * MANUAL_PAYMENT_CONFIRMED as a side effect of moving one Item along the
 * pipeline, but nothing in the docs ties a Payment to a particular step.
 * CONTEXT.md says the Deposit is "charged once at submission", so it is
 * normally still PENDING while every pair is REQUEST_SUBMITTED or
 * UNDER_REVIEW, where the only allowed moves are the review steps, not
 * "payment"; and the Balance arrives when the pairs are Ready, when the
 * only move left is Completed. ADR-0002 only gates what comes later ("the
 * Order does not advance past the Approved status" until the owner marks
 * the Deposit received; Completed waits for the Balance), and it is the
 * owner's review, not the payment, that advances a pair. So this settles
 * the Payment and writes the audit entry on each live pair without
 * touching any status.
 *
 * Idempotent on `idempotencyKey` (ADR-0012): a retry, e.g. a double click,
 * returns "already-confirmed" rather than an error. If the Payment was
 * settled another way (or every pair was cancelled), the repository throws
 * NoPendingPaymentError.
 */
export async function confirmPayment(
  deps: { orders: Pick<OrderRepository, "confirmPayment"> },
  actingUser: ActingUser,
  input: { paymentId: string; method: PaymentMethod; idempotencyKey: string },
): Promise<"confirmed" | "already-confirmed"> {
  requireRole(actingUser, "ADMIN");
  if (!MANUAL_METHODS.includes(input.method)) throw new InvalidPaymentMethodError();
  const applied = await deps.orders.confirmPayment({
    paymentId: input.paymentId,
    method: input.method,
    actorAccountId: actingUser.accountId,
    idempotencyKey: input.idempotencyKey,
  });
  return applied ? "confirmed" : "already-confirmed";
}
