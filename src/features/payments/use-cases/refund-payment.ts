import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { PaymentRepository } from "../repositories/payment-repository";

const MAX_REASON_LENGTH = 300;

export class InvalidRefundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRefundError";
  }
}

export type RefundPaymentResult = "refunded" | "already-refunded";

/**
 * "Refund Payment" (Payment Details panel): gives back a received Payment.
 * Admin-only (ADR-0012). Idempotent on `idempotencyKey`: a retry is
 * "already-refunded" and writes nothing. The repository throws
 * PaymentNotFoundError or PaymentNotRefundableError (never received, or
 * already refunded under a different key).
 */
export async function refundPayment(
  deps: { payments: PaymentRepository },
  actingUser: ActingUser,
  input: { paymentId: string; reason: string | null; idempotencyKey: string },
): Promise<RefundPaymentResult> {
  requireRole(actingUser, "ADMIN");
  if (!input.idempotencyKey) throw new InvalidRefundError("Reload and try again.");
  if (!input.paymentId) throw new InvalidRefundError("Reload and try again.");
  const reason = input.reason?.trim() || null;
  if (reason && reason.length > MAX_REASON_LENGTH) throw new InvalidRefundError("Reason is too long.");

  return deps.payments.refundPayment({ paymentId: input.paymentId, reason, actorAccountId: actingUser.accountId, idempotencyKey: input.idempotencyKey });
}
