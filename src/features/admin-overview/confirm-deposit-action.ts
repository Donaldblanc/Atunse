"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { UnauthorizedError } from "@/features/accounts/authz";
import { NoPendingDepositError } from "@/features/orders/repositories/order-repository";
import { confirmDeposit } from "@/features/orders/use-cases/confirm-deposit";
import { PrismaOrderRepository } from "@/features/orders/repositories/prisma-order-repository";
import { prisma } from "@/shared/db/prisma-client";

export type ConfirmDepositResult = { ok: true } | { ok: false; error: string };

/**
 * Pending Payments' "Mark Paid". The client generates `idempotencyKey` once
 * per row (ADR-0012), so a double click or retry settles the Deposit once.
 * A Deposit someone else already settled counts as done: the refreshed list
 * simply no longer has the row.
 */
export async function confirmDepositAction(orderId: string, idempotencyKey: string): Promise<ConfirmDepositResult> {
  if (typeof orderId !== "string" || typeof idempotencyKey !== "string" || !orderId || !idempotencyKey) {
    return { ok: false, error: "Something went wrong. Reload and try again." };
  }
  try {
    const actingUser = await actingUserFromCookies(await cookies());
    await confirmDeposit({ orders: new PrismaOrderRepository(prisma) }, actingUser, { orderId, idempotencyKey });
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: "Your session has ended. Sign in again." };
    if (!(err instanceof NoPendingDepositError)) {
      console.error("[admin-overview] confirming a deposit failed", err);
      return { ok: false, error: "Couldn't mark it paid. Try again." };
    }
  }
  revalidatePath("/admin");
  return { ok: true };
}
