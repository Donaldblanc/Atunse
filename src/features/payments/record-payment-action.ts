"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { UnauthorizedError } from "@/features/accounts/authz";
import { PAYMENT_METHODS, type PaymentMethod } from "@/features/orders/domain";
import { buildPaymentsDeps } from "@/features/payments/deps";
import { OrderNotFoundError } from "@/features/payments/repositories/payment-repository";
import { InvalidRecordPaymentError, recordPayment } from "@/features/payments/use-cases/record-payment";
import { redactForLog } from "@/shared/logging/redact";

export type RecordPaymentResult = { ok: true } | { ok: false; error: string };

/**
 * "Record Payment" (header button): logs a payment against an Order outside
 * the Deposit/Balance flow. The client generates `idempotencyKey` once per
 * form open (ADR-0012), so a double submit records it once.
 */
export async function recordPaymentAction(formData: FormData): Promise<RecordPaymentResult> {
  const orderReference = formData.get("orderReference");
  const amount = formData.get("amount");
  const method = formData.get("method");
  const reference = formData.get("reference");
  const idempotencyKey = formData.get("idempotencyKey");

  if (typeof orderReference !== "string" || typeof amount !== "string" || typeof method !== "string" || typeof idempotencyKey !== "string" || !idempotencyKey) {
    return { ok: false, error: "Something went wrong. Reload and try again." };
  }
  if (!PAYMENT_METHODS.includes(method as PaymentMethod)) return { ok: false, error: "Choose a payment method." };
  const dollars = Number(amount);
  if (!Number.isFinite(dollars)) return { ok: false, error: "Enter a valid amount." };
  const amountCents = Math.round(dollars * 100);

  try {
    const actingUser = await actingUserFromCookies(await cookies());
    await recordPayment(
      buildPaymentsDeps(),
      actingUser,
      { orderReference, amountCents, method: method as PaymentMethod, reference: typeof reference === "string" ? reference : null, idempotencyKey },
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: "Your session has ended. Sign in again." };
    if (err instanceof InvalidRecordPaymentError) return { ok: false, error: err.message };
    if (err instanceof OrderNotFoundError) return { ok: false, error: "No order matches that number." };
    console.error(`[payments] recording a payment failed: ${redactForLog(err instanceof Error ? err.message : String(err))}`);
    return { ok: false, error: "Couldn't record the payment. Try again." };
  }
  revalidatePath("/admin/payments");
  return { ok: true };
}
