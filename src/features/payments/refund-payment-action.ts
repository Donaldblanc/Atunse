"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { UnauthorizedError } from "@/features/accounts/authz";
import { PaymentNotFoundError, PaymentNotRefundableError } from "@/features/payments/repositories/payment-repository";
import { PrismaPaymentRepository } from "@/features/payments/repositories/prisma-payment-repository";
import { InvalidRefundError, refundPayment } from "@/features/payments/use-cases/refund-payment";
import { prisma } from "@/shared/db/prisma-client";
import { redactForLog } from "@/shared/logging/redact";

export type RefundPaymentResult = { ok: true } | { ok: false; error: string };

/**
 * "Refund Payment" (Payment Details panel). The client generates
 * `idempotencyKey` once per row, so a double click settles it once
 * (ADR-0012).
 */
export async function refundPaymentAction(paymentId: string, reason: string, idempotencyKey: string): Promise<RefundPaymentResult> {
  if (typeof paymentId !== "string" || typeof idempotencyKey !== "string" || !paymentId || !idempotencyKey) {
    return { ok: false, error: "Something went wrong. Reload and try again." };
  }
  try {
    const actingUser = await actingUserFromCookies(await cookies());
    await refundPayment({ payments: new PrismaPaymentRepository(prisma) }, actingUser, { paymentId, reason: reason || null, idempotencyKey });
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: "Your session has ended. Sign in again." };
    if (err instanceof InvalidRefundError) return { ok: false, error: err.message };
    if (err instanceof PaymentNotFoundError) return { ok: false, error: "That payment no longer exists." };
    if (err instanceof PaymentNotRefundableError) return { ok: false, error: err.message };
    console.error(`[payments] refunding a payment failed: ${redactForLog(err instanceof Error ? err.message : String(err))}`);
    return { ok: false, error: "Couldn't refund the payment. Try again." };
  }
  revalidatePath("/admin/payments");
  return { ok: true };
}
