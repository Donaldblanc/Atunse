"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { requireRole, UnauthorizedError } from "@/features/accounts/authz";
import { buildOrderUseCaseDeps } from "@/features/orders/deps";
import { ItemNotFoundError, ItemStatusChangedError } from "@/features/orders/repositories/order-repository";
import { recordApproval } from "@/features/orders/use-cases/record-approval";
import { InvalidQuoteError, sendQuote } from "@/features/orders/use-cases/send-quote";
import { parseQuotePrice } from "./quote-price";

/** `notice` is a success message that still needs the owner's attention (e.g. the email failed). */
export type QuoteStepState = { error: string | null; notice: string | null };

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function failure(err: unknown): QuoteStepState {
  if (err instanceof InvalidQuoteError || err instanceof ItemStatusChangedError) return { error: err.message, notice: null };
  if (err instanceof ItemNotFoundError) return { error: "This pair no longer exists.", notice: null };
  if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that.", notice: null };
  throw err;
}

/**
 * Order detail's Send Quote: the owner's final price for one pair, dollars
 * in the form and integer cents from here on. Sets the price, moves the
 * pair to Quote Sent and emails the customer, once (the idempotency key was
 * made when the form rendered, ADR-0012). The admin check comes before
 * anything is read.
 */
export async function sendQuoteAction(_previous: QuoteStepState, formData: FormData): Promise<QuoteStepState> {
  const itemId = text(formData, "itemId");
  const idempotencyKey = text(formData, "idempotencyKey");
  if (!itemId || !idempotencyKey) return { error: "That request wasn't valid. Reload and try again.", notice: null };
  const price = parseQuotePrice(text(formData, "price"));

  try {
    const actingUser = await actingUserFromCookies(await cookies());
    requireRole(actingUser, "ADMIN");
    if (!price.ok) return { error: price.error, notice: null };
    const result = await sendQuote(buildOrderUseCaseDeps(), actingUser, { itemId, priceCents: price.cents, idempotencyKey });
    revalidatePath("/admin");
    if (result.status === "sent" && result.emailFailed) {
      return { error: null, notice: "The quote is saved, but its email couldn't be sent. Let the customer know the price yourself." };
    }
    return { error: null, notice: "Quote sent." };
  } catch (err) {
    return failure(err);
  }
}

/** Order detail's "Customer approved": the owner records the customer's yes; the audit entry names who recorded it. */
export async function recordApprovalAction(_previous: QuoteStepState, formData: FormData): Promise<QuoteStepState> {
  const itemId = text(formData, "itemId");
  const idempotencyKey = text(formData, "idempotencyKey");
  if (!itemId || !idempotencyKey) return { error: "That request wasn't valid. Reload and try again.", notice: null };

  try {
    const actingUser = await actingUserFromCookies(await cookies());
    requireRole(actingUser, "ADMIN");
    await recordApproval({ orders: buildOrderUseCaseDeps().orders }, actingUser, { itemId, idempotencyKey });
    revalidatePath("/admin");
    return { error: null, notice: "Approval recorded." };
  } catch (err) {
    return failure(err);
  }
}
