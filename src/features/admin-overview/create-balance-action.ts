"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { UnauthorizedError } from "@/features/accounts/authz";
import { OrderNotFoundError } from "@/features/orders/repositories/order-repository";
import { PrismaOrderRepository } from "@/features/orders/repositories/prisma-order-repository";
import { createBalance } from "@/features/orders/use-cases/create-balance";
import { prisma } from "@/shared/db/prisma-client";
import { redactForLog } from "@/shared/logging/redact";

export type CreateBalanceResult = { ok: true } | { ok: false; error: string };

/** The Order dialog's "Create Balance" for an Order that was ready before Balances were recorded. A repeat is harmless (the use-case is idempotent). */
export async function createBalanceAction(orderId: string): Promise<CreateBalanceResult> {
  if (typeof orderId !== "string" || !orderId) return { ok: false, error: "Something went wrong. Reload and try again." };
  try {
    const actingUser = await actingUserFromCookies(await cookies());
    await createBalance({ orders: new PrismaOrderRepository(prisma) }, actingUser, { orderId });
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: "Your session has ended. Sign in again." };
    if (err instanceof OrderNotFoundError) return { ok: false, error: "This order no longer exists." };
    console.error(`[admin-overview] creating a balance failed: ${redactForLog(err instanceof Error ? err.message : String(err))}`);
    return { ok: false, error: "Couldn't create the balance. Try again." };
  }
  revalidatePath("/admin");
  return { ok: true };
}
