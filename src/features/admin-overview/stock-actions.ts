"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { requireRole } from "@/features/accounts/authz";
import { buildInventoryDeps } from "@/features/inventory/deps";
import { adjustStock } from "@/features/inventory/use-cases/adjust-stock";

export type AdjustStockState = { error: string | null; /** Bumped on each success so the form can clear itself. */ done: number };

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

// A database id (cuid) and a whole number: the only shapes the form fields may take.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const INTEGER_PATTERN = /^[+-]?\d{1,9}$/;

/**
 * Low Stock's Adjust stock. The admin role is checked before anything is
 * read (ADR-0012). `seenStock` is the stock on screen, so a replay or a
 * stale tab is refused by the repository (adjustStock). Nothing is logged.
 */
export async function adjustStockAction(previous: AdjustStockState, formData: FormData): Promise<AdjustStockState> {
  const actingUser = await actingUserFromCookies(await cookies());
  requireRole(actingUser, "ADMIN");

  const itemId = text(formData, "itemId");
  const change = text(formData, "change").trim();
  const seenStock = text(formData, "seenStock");
  if (!ID_PATTERN.test(itemId) || !text(formData, "idempotencyKey") || !INTEGER_PATTERN.test(seenStock)) {
    return { ...previous, error: "That request wasn't valid. Reload and try again." };
  }
  if (!INTEGER_PATTERN.test(change)) return { ...previous, error: "Enter a whole number other than 0." };

  const result = await adjustStock(buildInventoryDeps(), actingUser, {
    itemId,
    change: Number(change),
    reason: text(formData, "reason"),
    note: text(formData, "note"),
    seenStock: Number(seenStock),
  });
  // Revalidate on a refusal too: a stale-stock error needs the dialog re-rendered with the new figure and a fresh seenStock.
  revalidatePath("/admin");
  if (!result.ok) return { ...previous, error: result.error };

  return { error: null, done: previous.done + 1 };
}
