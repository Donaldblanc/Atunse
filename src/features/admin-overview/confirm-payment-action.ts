"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { UnauthorizedError } from "@/features/accounts/authz";
import { PAYMENT_METHODS, type PaymentMethod } from "@/features/orders/domain";
import { NoPendingPaymentError } from "@/features/orders/repositories/order-repository";
import { confirmPayment, InvalidPaymentMethodError } from "@/features/orders/use-cases/confirm-payment";
import { PrismaOrderRepository } from "@/features/orders/repositories/prisma-order-repository";
import { prisma } from "@/shared/db/prisma-client";
import { redactForLog } from "@/shared/logging/redact";

export type ConfirmPaymentResult = { ok: true } | { ok: false; error: string };

/**
 * "Mark Paid"/"Mark Received" for a Deposit or Balance (Pending Payments, the
 * Order dialog). The client generates `idempotencyKey` once per row
 * (ADR-0012), so a double click or retry settles the Payment once. A Payment
 * someone else already settled counts as done: the refreshed list simply no
 * longer has the row. `method` is how it arrived (Zelle or Cash).
 */
export async function confirmPaymentAction(paymentId: string, method: string, idempotencyKey: string): Promise<ConfirmPaymentResult> {
  if (typeof paymentId !== "string" || typeof idempotencyKey !== "string" || !paymentId || !idempotencyKey) {
    return { ok: false, error: "Something went wrong. Reload and try again." };
  }
  if (!PAYMENT_METHODS.includes(method as PaymentMethod)) return { ok: false, error: "Choose Zelle or Cash." };
  try {
    const actingUser = await actingUserFromCookies(await cookies());
    await confirmPayment({ orders: new PrismaOrderRepository(prisma) }, actingUser, { paymentId, method: method as PaymentMethod, idempotencyKey });
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: "Your session has ended. Sign in again." };
    if (err instanceof InvalidPaymentMethodError) return { ok: false, error: err.message };
    if (!(err instanceof NoPendingPaymentError)) {
      console.error(`[admin-overview] confirming a payment failed: ${redactForLog(err instanceof Error ? err.message : String(err))}`);
      return { ok: false, error: "Couldn't mark it received. Try again." };
    }
  }
  revalidatePath("/admin");
  return { ok: true };
}
