import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { PAYMENT_METHODS, type PaymentMethod } from "@/features/orders/domain";
import type { PaymentRepository } from "../repositories/payment-repository";

const MAX_REFERENCE_LENGTH = 100;
const MAX_AMOUNT_CENTS = 500_000; // same ceiling as a Quote (MAX_QUOTE_CENTS)

export class InvalidRecordPaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRecordPaymentError";
  }
}

export type RecordPaymentResult = "recorded" | "already-recorded";

/**
 * "Record Payment" (header button): logging a payment against an Order
 * outside the Deposit/Balance flow, e.g. a method the owner took in
 * person that the booking flow didn't already charge. Admin-only
 * (ADR-0012). Idempotent on `idempotencyKey`: a retry is "already-recorded"
 * and writes nothing. The repository throws OrderNotFoundError when
 * `orderReference` doesn't match an Order.
 */
export async function recordPayment(
  deps: { payments: PaymentRepository },
  actingUser: ActingUser,
  input: { orderReference: string; amountCents: number; method: PaymentMethod; reference: string | null; idempotencyKey: string },
): Promise<RecordPaymentResult> {
  requireRole(actingUser, "ADMIN");
  if (!input.idempotencyKey) throw new InvalidRecordPaymentError("Reload and try again.");
  if (!input.orderReference.trim()) throw new InvalidRecordPaymentError("Enter an order number.");
  if (!PAYMENT_METHODS.includes(input.method)) throw new InvalidRecordPaymentError("Choose a payment method.");
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new InvalidRecordPaymentError("Enter an amount greater than $0.");
  if (input.amountCents > MAX_AMOUNT_CENTS) throw new InvalidRecordPaymentError("Enter a smaller amount.");
  const reference = input.reference?.trim() || null;
  if (reference && reference.length > MAX_REFERENCE_LENGTH) throw new InvalidRecordPaymentError("Reference is too long.");

  return deps.payments.recordPayment({
    orderReference: input.orderReference.trim(),
    amountCents: input.amountCents,
    method: input.method,
    reference,
    actorAccountId: actingUser.accountId,
    idempotencyKey: input.idempotencyKey,
  });
}
